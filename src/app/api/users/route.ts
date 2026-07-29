import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        storeId: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(users);
  } catch (error: any) {
    console.error('GET /api/users error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { email, username, password, name, role, storeId } = await req.json();

    const userEmail = email || (username ? `${username}@joshisafahouse.com` : null);

    if (!userEmail || !password || !name) {
      return NextResponse.json({ error: 'Email/Username, password, and name are required' }, { status: 400 });
    }

    const validRoles = ['ADMIN', 'OWNER', 'EMPLOYEE'];
    const userRole = validRoles.includes(role) ? role : 'EMPLOYEE';

    // Check existing
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: userEmail },
          { username: username || userEmail },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Email or Username is already taken' }, { status: 400 });
    }

    const newUser = await prisma.user.create({
      data: {
        email: userEmail,
        username: username || userEmail.split('@')[0],
        password,
        name,
        role: userRole,
        storeId: storeId || null,
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        storeId: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/users error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create user' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/users error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete user' }, { status: 500 });
  }
}
