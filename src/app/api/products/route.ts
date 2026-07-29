import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        sales: true,
        rentals: {
          where: {
            rental: {
              status: { in: ['BOOKED', 'ACTIVE', 'OVERDUE'] },
              AND: [
                { startDate: { lte: new Date() } },
                { endDate: { gte: new Date() } },
              ],
            },
          },
        },
      },
    });

    const productsWithAvailability = products.map((product) => {
      const soldQuantity = product.sales.reduce((sum, item) => sum + item.quantity, 0);
      const unreturnedRentalQuantity = product.rentals.reduce((sum, item) => {
        const outstanding = item.quantity - item.returnedQuantity;
        return sum + Math.max(0, outstanding);
      }, 0);

      const availableQuantity = Math.max(0, product.totalQuantity - soldQuantity - unreturnedRentalQuantity);

      return {
        ...product,
        availableQuantity,
        // Keep totalQuantity as the original total
      };
    });

    return NextResponse.json(productsWithAvailability);
  } catch (error: any) {
    console.error('GET /api/products error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.name || !body.sku) {
      return NextResponse.json({ error: 'Name and SKU are required' }, { status: 400 });
    }

    const rentPrice = parseFloat(body.rentPrice || '0');
    const salePrice = parseFloat(body.salePrice || '0');
    const discount = parseFloat(body.discount || '0');
    const totalQuantity = parseInt(body.totalQuantity || '0');

    if (isNaN(rentPrice) || isNaN(salePrice) || isNaN(discount) || isNaN(totalQuantity)) {
      return NextResponse.json({ error: 'Invalid numeric values' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name: body.name,
        sku: body.sku,
        description: body.description || null,
        category: body.category || null,
        rentPrice,
        salePrice,
        discount,
        totalQuantity,
        isRentable: !!body.isRentable,
        isSellable: !!body.isSellable,
        image: body.image || null,
      } as any,
    });
    return NextResponse.json(product);
  } catch (error: any) {
    console.error('POST /api/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Convert numeric strings to actual numbers and filter data
    const updateData: any = {};
    const allowedFields = [
      'name', 'sku', 'description', 'category', 
      'rentPrice', 'salePrice', 'discount', 'totalQuantity', 
      'isRentable', 'isSellable', 'image'
    ];

    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = data[key];
      }
    });
    
    if (updateData.rentPrice !== undefined) {
      updateData.rentPrice = parseFloat(updateData.rentPrice?.toString() || '0') || 0;
    }
    
    if (updateData.salePrice !== undefined) {
      updateData.salePrice = parseFloat(updateData.salePrice?.toString() || '0') || 0;
    }

    if (updateData.discount !== undefined) {
      updateData.discount = parseFloat(updateData.discount?.toString() || '0') || 0;
    }
    
    if (updateData.totalQuantity !== undefined) {
      updateData.totalQuantity = parseInt(updateData.totalQuantity?.toString() || '0') || 0;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(product);
  } catch (error: any) {
    console.error('PUT /api/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
