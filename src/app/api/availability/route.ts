import { NextResponse } from 'next/server';
import { getProductAvailability } from '@/lib/inventory';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!productId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const available = await getProductAvailability(
      productId,
      new Date(startDate),
      new Date(endDate)
    );
    return NextResponse.json({ available });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
