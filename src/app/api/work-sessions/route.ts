import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Staff working hours, derived from login-to-logout sessions.
 *
 * GET  ?from=&to=&userId=   → sessions plus per-user totals for the range
 * POST { action: 'close', sessionId, reason }
 *
 * Sessions are opened by the login route. One with no loggedOutAt is someone
 * still on shift — the app cannot see a browser being closed, so those are
 * reported separately rather than silently counted as hours worked.
 */

const dayStart = (iso: string) => new Date(`${iso}T00:00:00`);
const dayEnd = (iso: string) => new Date(`${iso}T23:59:59.999`);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromRaw = searchParams.get('from');
    const toRaw = searchParams.get('to');
    const userId = searchParams.get('userId');

    const loggedInAt: any = {};
    if (fromRaw) loggedInAt.gte = dayStart(fromRaw);
    if (toRaw) loggedInAt.lte = dayEnd(toRaw);

    const sessions = await prisma.workSession.findMany({
      where: {
        ...(fromRaw || toRaw ? { loggedInAt } : {}),
        ...(userId ? { userId } : {}),
      },
      orderBy: { loggedInAt: 'desc' },
      include: { user: { select: { id: true, name: true, role: true, store: { select: { name: true } } } } },
      take: 500,
    });

    const minutesOf = (s: any) =>
      s.loggedOutAt ? Math.max(0, (new Date(s.loggedOutAt).getTime() - new Date(s.loggedInAt).getTime()) / 60000) : 0;

    const byUser = new Map<string, any>();
    for (const s of sessions) {
      const entry = byUser.get(s.userId) ?? {
        userId: s.userId,
        username: s.username,
        name: s.user?.name ?? s.username,
        role: s.user?.role ?? null,
        store: s.user?.store?.name ?? null,
        sessionCount: 0,
        openCount: 0,
        totalMinutes: 0,
        lastLogin: null as string | null,
        lastLogout: null as string | null,
      };
      entry.sessionCount += 1;
      if (!s.loggedOutAt) entry.openCount += 1;
      entry.totalMinutes += minutesOf(s);
      if (!entry.lastLogin) entry.lastLogin = s.loggedInAt.toISOString();
      if (!entry.lastLogout && s.loggedOutAt) entry.lastLogout = s.loggedOutAt.toISOString();
      byUser.set(s.userId, entry);
    }

    return NextResponse.json({
      range: { from: fromRaw, to: toRaw },
      sessions: sessions.map(s => ({
        id: s.id,
        userId: s.userId,
        username: s.username,
        name: s.user?.name ?? s.username,
        role: s.user?.role ?? null,
        loggedInAt: s.loggedInAt,
        loggedOutAt: s.loggedOutAt,
        logoutReason: s.logoutReason,
        minutes: minutesOf(s),
        open: !s.loggedOutAt,
      })),
      users: [...byUser.values()].sort((a, b) => b.totalMinutes - a.totalMinutes),
    });
  } catch (error: any) {
    console.error('GET /api/work-sessions error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load working hours' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body?.action === 'close') {
      const sessionId = body.sessionId;
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
      }

      const existing = await prisma.workSession.findUnique({ where: { id: sessionId } });
      if (!existing) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      // Closing twice must not move the original logout time.
      if (existing.loggedOutAt) {
        return NextResponse.json(existing);
      }

      const closed = await prisma.workSession.update({
        where: { id: sessionId },
        data: {
          loggedOutAt: new Date(),
          logoutReason: body.reason === 'CASHBOOK' ? 'CASHBOOK' : 'MANUAL',
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
