import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  collectionsFor,
  closingOf,
  getOrCreateBook,
  toISODay,
  dayStart,
} from '@/lib/cashbook';

/**
 * Staff record the day they are working; yesterday is history. Enforced here
 * as well as in the page, because a UI-only rule is no rule at all.
 */
function pastDayBlocked(date: string, role?: string) {
  if (role === 'ADMIN') return null;
  if (date === toISODay(new Date())) return null;
  return NextResponse.json(
    { error: "Only today's cash book can be changed. Ask an admin to adjust a past day." },
    { status: 403 }
  );
}

/**
 * The cash book for one store on one day.
 *
 * GET  ?storeId=&date=yyyy-mm-dd
 * POST { storeId, date, action: 'entry' | 'submit' | 'reopen', ... }
 *
 * A submitted day is locked: no further entries, and only an admin can
 * reopen it. That is the whole point of submitting — once the count has been
 * tallied, the figures should not move underneath it.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const date = searchParams.get('date') || toISODay(new Date());

    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }
    if (isNaN(dayStart(date).getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const book = await getOrCreateBook(storeId, date);
    const collections = await collectionsFor(storeId, date);
    const { paidOut, closing } = closingOf(book.openingBalance, collections.collected, book.entries);

    return NextResponse.json({
      id: book.id,
      storeId,
      date,
      openingBalance: book.openingBalance,
      ...collections,
      entries: book.entries,
      paidOut,
      closing,
      submitted: book.submitted,
      submittedAt: book.submittedAt,
      submittedBy: book.submittedBy,
      approvedAt: (book as any).approvedAt ?? null,
      approvedBy: (book as any).approvedBy ?? null,
      approvedAmount: (book as any).approvedAmount ?? null,
      approvalNote: (book as any).approvalNote ?? null,
      /** What the floor says it handed over on this day. */
      handedOver: book.entries
        .filter((e: any) => ['BANK', 'OFFICE'].includes(e.type))
        .reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
      notes: book.notes,
    });
  } catch (error: any) {
    console.error('GET /api/cashbook error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load cash book' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeId, date, action } = body || {};

    if (!storeId || !date) {
      return NextResponse.json({ error: 'storeId and date are required' }, { status: 400 });
    }

    const book = await getOrCreateBook(storeId, date);

    if (action === 'reopen') {
      // Deliberately admin-only: reopening un-tallies a day that was signed off.
      if (body.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only an admin can reopen a submitted day' }, { status: 403 });
      }
      const updated = await prisma.cashBook.update({
        where: { id: book.id },
        data: {
          submitted: false,
          submittedAt: null,
          submittedBy: null,
          // A reopened day is no longer a day whose cash was confirmed.
          approvedAt: null,
          approvedBy: null,
          approvedAmount: null,
          approvalNote: null,
        } as any,
      });
      return NextResponse.json(updated);
    }

    if (action === 'approve') {
      // Only the person the money reaches can say it reached them.
      if (body.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Only an admin can confirm the cash was received' },
          { status: 403 }
        );
      }
      if (!book.submitted) {
        return NextResponse.json(
          { error: 'This day has not been submitted yet, so there is nothing to confirm' },
          { status: 400 }
        );
      }

      const raw = body.approvedAmount;
      const counted =
        raw === undefined || raw === null || raw === '' ? null : parseFloat(raw.toString());
      if (counted !== null && (!Number.isFinite(counted) || counted < 0)) {
        return NextResponse.json({ error: 'Counted amount is not a number' }, { status: 400 });
      }

      const updated = await prisma.cashBook.update({
        where: { id: book.id },
        data: {
          approvedAt: new Date(),
          approvedBy: body.approvedBy?.trim() || null,
          approvedAmount: counted,
          approvalNote: body.approvalNote?.trim() || null,
        } as any,
      });
      return NextResponse.json(updated);
    }

    if (book.submitted) {
      return NextResponse.json(
        { error: 'This day has been submitted and is locked. An admin can reopen it.' },
        { status: 409 }
      );
    }

    const stale = pastDayBlocked(date, body.role);
    if (stale) return stale;

    if (action === 'entry') {
      const type = String(body.type || '').toUpperCase();
      if (!['BANK', 'OFFICE', 'ADJUSTMENT'].includes(type)) {
        return NextResponse.json({ error: 'type must be BANK, OFFICE or ADJUSTMENT' }, { status: 400 });
      }

      const amount = parseFloat(body.amount?.toString() ?? '');
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
      }

      const entry = await prisma.cashEntry.create({
        data: {
          cashBookId: book.id,
          type,
          amount,
          reference: body.reference?.trim() || null,
          notes: body.notes?.trim() || null,
          createdBy: body.createdBy?.trim() || null,
        },
      });
      return NextResponse.json(entry);
    }

    if (action === 'editEntry') {
      // Corrections are an admin job: a super records the day, an admin fixes
      // a wrong figure afterwards.
      if (body.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only an admin can edit a cash entry' }, { status: 403 });
      }
      if (!body.entryId) {
        return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
      }

      const data: any = {};
      if ('amount' in body) {
        const amount = parseFloat(body.amount?.toString() ?? '');
        if (!Number.isFinite(amount) || amount <= 0) {
          return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
        }
        data.amount = amount;
      }
      if ('reference' in body) data.reference = body.reference?.trim() || null;
      if ('type' in body) {
        const type = String(body.type || '').toUpperCase();
        if (!['BANK', 'OFFICE', 'ADJUSTMENT'].includes(type)) {
          return NextResponse.json({ error: 'type must be BANK, OFFICE or ADJUSTMENT' }, { status: 400 });
        }
        data.type = type;
      }

      const updated = await prisma.cashEntry.update({ where: { id: body.entryId }, data });
      return NextResponse.json(updated);
    }

    if (action === 'submit') {
      const collections = await collectionsFor(storeId, date);
      let fresh = await prisma.cashBook.findUnique({
        where: { id: book.id },
        include: { entries: true },
      });
      let { closing } = closingOf(fresh!.openingBalance, collections.collected, fresh!.entries);

      /**
       * Handing the day's cash over as part of closing the account.
       *
       * Before this, submitting only locked the day and the closing balance
       * carried to tomorrow. To actually start the next day at zero, staff had
       * to remember to add a separate entry first, and had to decide between
       * "bank remittance" and "cash to office" with nothing telling them which
       * — so most days it simply was not done and the balance rolled on.
       *
       * The handover is now part of submitting: one figure, defaulting to
       * everything in the drawer, recorded as an entry so it shows in the
       * day's list like any other cash going out.
       */
      if (body.handOver !== undefined && body.handOver !== null && body.handOver !== '') {
        const amount = parseFloat(body.handOver?.toString() ?? '');
        if (!Number.isFinite(amount) || amount < 0) {
          return NextResponse.json({ error: 'Hand-over amount is not a number' }, { status: 400 });
        }
        // More than is in the drawer cannot leave it.
        if (amount > closing + 0.001) {
          return NextResponse.json(
            {
              error: `Only ${closing.toFixed(2)} is in the drawer — you cannot hand over ${amount.toFixed(2)}.`,
            },
            { status: 400 }
          );
        }

        if (amount > 0) {
          // Who took the cash. Required: money leaving the drawer with nobody
          // named against it is exactly the gap this whole screen exists to
          // close, and "it went to the office" is not an answer anyone can
          // follow up on a week later.
          const handedTo = (body.handOverTo || '').trim();
          if (!handedTo) {
            return NextResponse.json(
              { error: 'Name the person the cash was handed to' },
              { status: 400 }
            );
          }

          const handOverType = String(body.handOverType || 'OFFICE').toUpperCase();
          await prisma.cashEntry.create({
            data: {
              cashBookId: book.id,
              type: ['BANK', 'OFFICE'].includes(handOverType) ? handOverType : 'OFFICE',
              amount,
              reference: handedTo,
              notes: body.handOverReference?.trim()
                ? `Handed over at day close · ${body.handOverReference.trim()}`
                : 'Handed over at day close',
              createdBy: body.submittedBy?.trim() || null,
            },
          });

          fresh = await prisma.cashBook.findUnique({
            where: { id: book.id },
            include: { entries: true },
          });
          closing = closingOf(fresh!.openingBalance, collections.collected, fresh!.entries).closing;
        }
      }

      const updated = await prisma.cashBook.update({
        where: { id: book.id },
        data: {
          submitted: true,
          submittedAt: new Date(),
          submittedBy: body.submittedBy?.trim() || null,
          notes: body.notes?.trim() || null,
        },
      });

      // Closing is returned so the caller can show what carries to tomorrow.
      return NextResponse.json({ ...updated, closing });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('POST /api/cashbook error:', error);
    return NextResponse.json({ error: error.message || 'Cash book update failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get('entryId');
    if (!entryId) {
      return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
    }

    const entry = await prisma.cashEntry.findUnique({
      where: { id: entryId },
      include: { cashBook: true },
    });
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }
    if (entry.cashBook.submitted) {
      return NextResponse.json(
        { error: 'This day is submitted and locked. An admin can reopen it.' },
        { status: 409 }
      );
    }

    const stale = pastDayBlocked(toISODay(entry.cashBook.date), searchParams.get('role') || undefined);
    if (stale) return stale;

    await prisma.cashEntry.delete({ where: { id: entryId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/cashbook error:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove entry' }, { status: 500 });
  }
}
