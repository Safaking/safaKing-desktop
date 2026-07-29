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
