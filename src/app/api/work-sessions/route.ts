import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Staff working hours, a row per person per day.
 *
 * A shift is the day's first login to its last sign-out, which is how the shop
 * thinks about it — not a sum of individual sessions, since stepping away and
 * signing back in does not shorten the day worked.
 *
 * GET ?date=yyyy-mm-dd         → everyone who worked that day
 * GET                          → today by default
 * GET ?userId=&date=yyyy-mm-dd → what that person did on that day
 * POST { action: 'close', sessionId, reason }
 */

const dayKey = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
const dayStart = (iso: string) => new Date(`${iso}T00:00:00`);
const dayEnd = (iso: string) => new Date(`${iso}T23:59:59.999`);

/** No heartbeat for this long means the app is gone, not idle. */
const STALE_MINUTES = 10;

/**
 * Close sessions whose heartbeat stopped, at the moment it stopped.
 *
 * The app cannot observe its own window being closed reliably — a crash, a
 * flat battery or a pulled plug leave nothing behind. Rather than leaving
 * those sessions open forever (reporting no hours at all), they are closed at
 * the last time the app was known to be running, which is the closest honest
 * answer available.
 */
async function closeStaleSessions() {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000);
  const stale = await prisma.workSession.findMany({
    where: { loggedOutAt: null, lastSeenAt: { lt: cutoff } },
    select: { id: true, lastSeenAt: true },
  });

  await Promise.all(
    stale.map(s =>
      prisma.workSession.update({
        where: { id: s.id },
        data: { loggedOutAt: s.lastSeenAt, logoutReason: 'AUTO' },
      })
    )
  );

  return stale.length;
}

/** What a person actually did on a day, drawn from the records they touched. */
async function activityFor(userId: string, date: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { events: [] };

  const who = user.username || user.name;
  const range = { gte: dayStart(date), lte: dayEnd(date) };

  const [rentals, sales, readyRentals, cashBooks, sessions] = await Promise.all([
    prisma.rental.findMany({
      where: { createdBy: who, createdAt: range },
      select: { id: true, orderNumber: true, customerName: true, totalAmount: true, createdAt: true },
    }),
    prisma.sale.findMany({
      where: { createdBy: who, createdAt: range },
      select: { id: true, orderNumber: true, customerName: true, totalAmount: true, createdAt: true },
    }),
    prisma.rental.findMany({
      where: { readyBy: who, readyAt: range },
      select: { id: true, orderNumber: true, customerName: true, readyAt: true },
    }),
    prisma.cashBook.findMany({
      where: { submittedBy: who, submittedAt: range },
      select: { id: true, date: true, submittedAt: true, store: { select: { name: true } } },
    }),
    prisma.workSession.findMany({
      where: { userId, loggedInAt: range },
      orderBy: { loggedInAt: 'asc' },
    }),
  ]);

  const events = [
    ...sessions.map(s => ({
      at: s.loggedInAt,
      kind: 'LOGIN' as const,
      label: 'Logged in',
      detail: '',
    })),
    ...sessions
      .filter(s => s.loggedOutAt)
      .map(s => ({
        at: s.loggedOutAt as Date,
        kind: 'LOGOUT' as const,
        label:
          s.logoutReason === 'CASHBOOK'
            ? 'Signed out — cash book closed'
            : s.logoutReason === 'CLOSED'
            ? 'App closed'
            : s.logoutReason === 'AUTO'
            ? 'Auto signed out — app stopped responding'
            : 'Signed out',
        detail: '',
      })),
    ...rentals.map(r => ({
      at: r.createdAt,
      kind: 'RENTAL' as const,
      label: `Booking ${r.orderNumber}`,
      detail: `${r.customerName} · ₹${Math.round(r.totalAmount || 0)}`,
    })),
    ...sales.map(s => ({
      at: s.createdAt,
      kind: 'SALE' as const,
      label: `Sale ${s.orderNumber}`,
      detail: `${s.customerName} · ₹${Math.round(s.totalAmount || 0)}`,
    })),
    ...readyRentals.map(r => ({
      at: r.readyAt as Date,
      kind: 'READY' as const,
      label: `Marked ready ${r.orderNumber}`,
      detail: r.customerName,
    })),
    ...cashBooks.map(c => ({
      at: c.submittedAt as Date,
      kind: 'CASHBOOK' as const,
      label: 'Cash book submitted',
      detail: c.store?.name ?? '',
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return { events };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');

    if (userId && date) {
      return NextResponse.json(await activityFor(userId, date));
    }

    // Self-healing: anything abandoned is settled before the figures are read.
    await closeStaleSessions();

    // One day at a time: the shop asks "who worked today", not "who worked
    // some time this month".
    const day = date || dayKey(new Date());
    if (isNaN(dayStart(day).getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const sessions = await prisma.workSession.findMany({
      where: { loggedInAt: { gte: dayStart(day), lte: dayEnd(day) } },
      orderBy: { loggedInAt: 'asc' },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    // One row per person per day: first in, last out, and the span between.
    const byDay = new Map<string, any>();
    for (const s of sessions) {
      const date = dayKey(s.loggedInAt);
      const key = `${s.userId}|${date}`;
      const row = byDay.get(key) ?? {
        key,
        userId: s.userId,
        username: s.username,
        name: s.user?.name ?? s.username,
        role: s.user?.role ?? null,
        date,
        firstLogin: s.loggedInAt,
        lastLogout: null as Date | null,
        sessionCount: 0,
        openCount: 0,
      };

      row.sessionCount += 1;
      if (s.loggedInAt < row.firstLogin) row.firstLogin = s.loggedInAt;
      if (s.loggedOutAt) {
        if (!row.lastLogout || s.loggedOutAt > row.lastLogout) row.lastLogout = s.loggedOutAt;
      } else {
        row.openCount += 1;
      }
      byDay.set(key, row);
    }

    const rows = [...byDay.values()]
      .map(r => {
        // A sign-out dated after the login day means the session was left open
        // overnight — the browser was closed rather than the shift ending. The
        // span is then not hours worked, so it is flagged rather than reported
        // as fact; an inflated figure here would feed straight into wages.
        const overnight = !!r.lastLogout && dayKey(new Date(r.lastLogout)) !== r.date;
        return {
          ...r,
          // Still on shift: no closing time yet, so no hours to report.
          minutes:
            r.lastLogout && !overnight
              ? Math.max(0, (new Date(r.lastLogout).getTime() - new Date(r.firstLogin).getTime()) / 60000)
              : 0,
          open: r.openCount > 0,
          overnight,
        };
      })
      .sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : b.date.localeCompare(a.date)));

    return NextResponse.json({ date: day, rows });
  } catch (error: any) {
    console.error('GET /api/work-sessions error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load working hours' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body?.action === 'resume') {
      // A refresh fires the same "window is going away" event as a real close,
      // so the session gets shut and the person carries on working untracked.
      // On load the app checks in: if its session is still open this is just a
      // heartbeat, and if it was closed a fresh one is opened for the rest of
      // the shift. The day is measured first-login to last-sign-out, so the
      // extra row does not change the hours reported.
      const { sessionId, userId } = body;
      if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      }

      if (sessionId) {
        const alive = await prisma.workSession.findFirst({
          where: { id: sessionId, loggedOutAt: null },
        });
        if (alive) {
          await prisma.workSession.update({
            where: { id: alive.id },
            data: { lastSeenAt: new Date() },
          });
          return NextResponse.json({ sessionId: alive.id, resumed: false });
        }
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const fresh = await prisma.workSession.create({
        data: {
          userId: user.id,
          username: user.username || user.email || user.name,
          storeId: user.storeId,
        },
      });
      return NextResponse.json({ sessionId: fresh.id, resumed: true });
    }

    if (body?.action === 'heartbeat') {
      if (!body.sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
      }
      // updateMany rather than update: a session already closed simply matches
      // nothing, instead of throwing.
      await prisma.workSession.updateMany({
        where: { id: body.sessionId, loggedOutAt: null },
        data: { lastSeenAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (body?.action === 'close') {
      const sessionId = body.sessionId;
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
      }

      const existing = await prisma.workSession.findUnique({ where: { id: sessionId } });
      if (!existing) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      // Closing twice must not move the original sign-out time.
      if (existing.loggedOutAt) return NextResponse.json(existing);

      const closed = await prisma.workSession.update({
        where: { id: sessionId },
        data: {
          loggedOutAt: new Date(),
          logoutReason: ['CASHBOOK', 'CLOSED', 'AUTO'].includes(body.reason)
            ? body.reason
            : 'MANUAL',
        },
      });
      return NextResponse.json(closed);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('POST /api/work-sessions error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update session' }, { status: 500 });
  }
}
