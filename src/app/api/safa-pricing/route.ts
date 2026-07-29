import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let pricing = await prisma.safaPricing.findUnique({
      where: { id: 'default' },
    });

    if (!pricing) {
      pricing = await prisma.safaPricing.create({
        data: {
          id: 'default',
          roundedPrice: 50,
          jodhpuriPrice: 50,
          baratiSafaPrice: 50,
        },
      });
    }

    return NextResponse.json(pricing);
  } catch (error: any) {
    console.error('GET /api/safa-pricing error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch Safa pricing' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { roundedPrice, jodhpuriPrice, baratiSafaPrice } = await req.json();

    const rounded = parseFloat(roundedPrice?.toString() || '50') || 50;
    const jodhpuri = parseFloat(jodhpuriPrice?.toString() || '50') || 50;
    const baratiSafa = parseFloat(baratiSafaPrice?.toString() || '50') || 50;

    const pricing = await prisma.safaPricing.upsert({
      where: { id: 'default' },
      update: {
        roundedPrice: rounded,
        jodhpuriPrice: jodhpuri,
        baratiSafaPrice: baratiSafa,
      },
      create: {
        id: 'default',
        roundedPrice: rounded,
        jodhpuriPrice: jodhpuri,
        baratiSafaPrice: baratiSafa,
      },
    });

    return NextResponse.json(pricing);
  } catch (error: any) {
    console.error('POST /api/safa-pricing error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update Safa pricing' }, { status: 500 });
  }
}
