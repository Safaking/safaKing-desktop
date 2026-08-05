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
        data: { submitted: false, submittedAt: null, submittedBy: null },
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

    if (action === 'submit') {
      const collections = await collectionsFor(storeId, date);
      const fresh = await prisma.cashBook.findUnique({
        where: { id: book.id },
        include: { entries: true },
      });
      const { closing } = closingOf(fresh!.openingBalance, collections.collected, fresh!.entries);

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
