import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function seed() {
  const products = [
    {
      name: 'Sony A7IV Camera',
      sku: 'SONY-A7IV-001',
      rentPrice: 1200,
      salePrice: 150000,
      totalQuantity: 5,
      isRentable: true,
      isSellable: true,
      category: 'Camera',
    },
    {
      name: 'DJI RS3 Pro Gimbal',
      sku: 'DJI-RS3P-001',
      rentPrice: 800,
      salePrice: 45000,
      totalQuantity: 3,
      isRentable: true,
      isSellable: true,
      category: 'Stabilizer',
    },
    {
      name: 'SD Card 128GB',
      sku: 'SD-128-001',
      rentPrice: 100,
      salePrice: 2500,
      totalQuantity: 50,
      isRentable: false,
      isSellable: true,
      category: 'Accessory',
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }

  console.log('Seed completed');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
