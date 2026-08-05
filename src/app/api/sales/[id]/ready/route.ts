import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureDbSchema } from '@/lib/db-init';

export async function POST(request: Request, { params }: { params: any }) {
  await ensureDbSchema();
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;
    if (!id) return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const ready = body?.ready !== false;
    const readyBy = typeof body?.readyBy === 'string' ? body.readyBy.trim() : '';

    const existing = await prisma.sale.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Sale order not found' }, { status: 404 });

    const sale = await prisma.sale.update({
      where: { id },
      data: ready
        ? { readyAt: new Date(), readyBy: readyBy || null }
        : { readyAt: null, readyBy: null },
    });

    return NextResponse.json(sale);
  } catch (error: any) {
    console.error('POST /api/sales/[id]/ready error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update ready state' }, { status: 500 });
  }
}
