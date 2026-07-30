import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let options = await prisma.safaOption.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Auto-seed default options if empty
    if (options.length === 0) {
      options = await prisma.$transaction([
        prisma.safaOption.create({ data: { name: 'Rounded', price: 50 } }),
        prisma.safaOption.create({ data: { name: 'Jodhpuri', price: 50 } }),
        prisma.safaOption.create({ data: { name: 'Barati safa', price: 50 } }),
      ]);
    }

    return NextResponse.json(options);
  } catch (error: any) {
    console.error('GET /api/safa-options error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch safa options' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, price } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const newOption = await prisma.safaOption.create({
      data: {
        name,
        price: parseFloat(price?.toString() || '0') || 0,
      },
    });

    return NextResponse.json(newOption);
  } catch (error: any) {
    console.error('POST /api/safa-options error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create safa option' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, price } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'ID and Name are required' }, { status: 400 });
    }

    const updatedOption = await prisma.safaOption.update({
      where: { id },
      data: {
        name,
        price: parseFloat(price?.toString() || '0') || 0,
      },
    });

    return NextResponse.json(updatedOption);
  } catch (error: any) {
    console.error('PUT /api/safa-options error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update safa option' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Option ID is required' }, { status: 400 });
    }

    await prisma.safaOption.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/safa-options error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete safa option' }, { status: 500 });
  }
}
