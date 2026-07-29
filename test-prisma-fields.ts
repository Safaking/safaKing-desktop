import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Rental Model Fields:')
  // @ts-ignore
  console.log(Object.keys(prisma.rental.fields || {}))
  
  try {
    const dummy = await prisma.rental.findFirst()
    console.log('Sample Rental:', dummy)
  } catch (e) {
    console.error('Error fetching rental:', e)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
