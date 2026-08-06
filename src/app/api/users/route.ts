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
        canManageVendors: true,
        language: true,
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

    const validRoles = ['ADMIN', 'SUPER', 'USER'];
    const userRole = validRoles.includes(role) ? role : 'USER';

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

/**
 * Update an existing user: username, password, name, role, store, and the
 * vendor permission. Admin-only in the UI — this is how an id/password gets
 * reset without touching the database directly.
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, username, password, name, role, storeId, canManageVendors } = body || {};

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data: any = {};

    if (typeof username === 'string' && username.trim() && username.trim() !== existing.username) {
      const taken = await prisma.user.findFirst({
        where: { username: username.trim(), NOT: { id } },
      });
      if (taken) {
        return NextResponse.json({ error: 'That username is already taken' }, { status: 400 });
      }
      data.username = username.trim();
    }

    // Blank means "leave the password alone" rather than clearing it.
    if (typeof password === 'string' && password.trim()) {
      data.password = password.trim();
    }

    if (typeof name === 'string' && name.trim()) data.name = name.trim();

    if (typeof role === 'string' && ['ADMIN', 'SUPER', 'USER'].includes(role)) {
      // Refuse to remove the last admin, which would lock everyone out of the
      // admin panel with no way back in through the UI.
      if (existing.role === 'ADMIN' && role !== 'ADMIN') {
        const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (admins <= 1) {
          return NextResponse.json(
            { error: 'This is the only admin. Promote another user to admin first.' },
            { status: 400 }
          );
        }
      }
      data.role = role;
    }

    if ('storeId' in body) data.storeId = storeId || null;
    if (typeof canManageVendors === 'boolean') data.canManageVendors = canManageVendors;
    if (body.language === 'en' || body.language === 'hi') data.language = body.language;

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        canManageVendors: true,
        storeId: true,
        store: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/users error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update user' }, { status: 500 });
  }
}
