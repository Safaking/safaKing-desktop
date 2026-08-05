import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { username, email, password } = await req.json();
    const identifier = email || username;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Email or Username and password are required' }, { status: 400 });
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      const count = await prisma.user.count();
      if (count === 0 && (identifier === 'admin' || identifier === 'admin@joshisafahouse.com')) {
        user = await prisma.user.create({
          data: {
            email: 'admin@joshisafahouse.com',
            username: 'admin',
            password: 'admin123',
            name: 'Administrator',
            role: 'ADMIN',
          },
          include: {
            store: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });
      }
    }

    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Invalid email/username or password' }, { status: 401 });
    }

    // Opening the session here means working hours start at the moment of a
    // successful login, with no extra round-trip the client could skip.
    const session = await prisma.workSession.create({
      data: {
        userId: user.id,
        username: user.username || user.email || user.name,
        storeId: user.storeId,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      id: user.id,
      email: user.email,
      username: user.username || user.email,
      name: user.name,
      role: user.role,
      // Drives whether a SUPER sees the vendor register.
      canManageVendors: user.canManageVendors,
      storeId: user.storeId,
      store: user.store,
    });
  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
