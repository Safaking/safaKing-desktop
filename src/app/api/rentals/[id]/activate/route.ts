import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: any }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;

    if (!id) {
      return NextResponse.json({ error: 'Rental ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { pickupName, pickupPhone, pickupDate } = body;

    if (!pickupName || !pickupPhone) {
      return NextResponse.json({ error: 'Receiver name and phone number are required' }, { status: 400 });
    }

    const updatedRental = await prisma.rental.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        pickupName,
        pickupPhone,
        pickupDate: pickupDate || new Date().toISOString(),
      },
    });

    return NextResponse.json(updatedRental);
  } catch (error: any) {
    console.error('POST /api/rentals/[id]/activate error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to activate rental' }, { status: 500 });
  }
}
