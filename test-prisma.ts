import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.user.updateMany({
      where: { username: 'admin' },
      data: { email: 'admin@joshisafahouse.com' }
    })
    const user = await prisma.user.findFirst({ where: { username: 'admin' } })
    console.log('Updated Admin User:', user)
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
