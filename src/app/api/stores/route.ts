import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const stores = await prisma.store.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, location } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Store name is required' }, { status: 400 });
    }

    const store = await prisma.store.create({
      data: {
        name,
        location
      }
    });

    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
  }
}

/**
 * Update a branch. Currently only the mark it trades under.
 *
 * Sending logo: null puts the branch back on the shop default rather than
 * blanking the bill, which is what "no choice made" has always meant here.
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.id) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    const data: any = {};
    if ('logo' in body) {
      const logo = typeof body.logo === 'string' ? body.logo.trim() : '';
      // Only paths this app actually serves — a bill must not be able to pull
      // an image from somewhere else.
      if (logo && !logo.startsWith('/assets/')) {
        return NextResponse.json({ error: 'Unknown logo' }, { status: 400 });
      }
      data.logo = logo || null;
    }
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if ('location' in body) data.location = body.location?.trim() || null;

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const store = await prisma.store.update({ where: { id: body.id }, data });
    return NextResponse.json(store);
  } catch (error: any) {
    console.error('Error updating store:', error);
    return NextResponse.json({ error: error.message || 'Failed to update store' }, { status: 500 });
  }
}
