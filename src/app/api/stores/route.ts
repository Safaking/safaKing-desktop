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
 * The branch details that only a GST tax invoice needs. Each branch bills
 * under its own GSTIN and address, so they are held per store rather than in
 * one shop-wide setting.
 */
const GST_TEXT_FIELDS = [
  'legalName', 'addressLine1', 'addressLine2', 'city', 'pincode',
  'stateName', 'stateCode', 'phones', 'email', 'gstin', 'msmeNumber',
  'bankName', 'bankAccount', 'bankIfsc', 'invoiceTerms', 'jurisdiction',
] as const;

/**
 * Update a branch: the mark it trades under, and its billing details.
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

    for (const field of GST_TEXT_FIELDS) {
      if (!(field in body)) continue;
      const value = typeof body[field] === 'string' ? body[field].trim() : '';
      // A GSTIN is always written in capitals, and is what the tax side of the
      // bill keys off — a lower-case one would not match the buyer's records.
      data[field] = value ? (field === 'gstin' ? value.toUpperCase() : value) : null;
    }
    if ('pricesIncludeTax' in body) data.pricesIncludeTax = !!body.pricesIncludeTax;

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
