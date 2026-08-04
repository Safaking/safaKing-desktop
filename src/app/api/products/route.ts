import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Availability is aggregated in SQL. Previously every product was loaded
    // with all of its sale and rental rows so they could be summed in JS, which
    // made this endpoint slower with every order the shop took.
    const productsWithAvailability = await prisma.$queryRaw`
      WITH sold AS (
        SELECT "productId", SUM("quantity") AS qty
        FROM "SaleItem"
        GROUP BY "productId"
      ),
      out_on_rent AS (
        SELECT ri."productId",
               SUM(GREATEST(0, ri."quantity" - ri."returnedQuantity")) AS qty
        FROM "RentalItem" ri
        JOIN "Rental" r ON r."id" = ri."rentalId"
        WHERE r."status" IN ('BOOKED', 'ACTIVE', 'OVERDUE')
          AND r."startDate" <= NOW()
          AND r."endDate" >= NOW()
        GROUP BY ri."productId"
      )
      SELECT p.*,
             GREATEST(0,
               p."totalQuantity" - COALESCE(s.qty, 0) - COALESCE(o.qty, 0)
             )::int AS "availableQuantity"
      FROM "Product" p
      LEFT JOIN sold s ON s."productId" = p."id"
      LEFT JOIN out_on_rent o ON o."productId" = p."id"
    `;

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
        productType: body.productType || null,
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
      'name', 'sku', 'description', 'category', 'productType',
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
