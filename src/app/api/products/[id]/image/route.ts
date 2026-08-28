import { prisma } from '@/lib/prisma';

/**
 * One product's photo, as an actual image rather than JSON.
 *
 * Photos are stored as data URIs on the product row. Sending them inside the
 * catalog listing meant every visit to the till downloaded all of them: 6.5 MB
 * of base64 for 36 KB of actual product data, and a 25-second wait before a
 * single safa appeared on screen.
 *
 * Served here instead, one request per photo, so the browser fetches only what
 * is on screen and — because the response is immutable and cache-busted by the
 * product's updatedAt — never fetches the same photo twice.
 */
export async function GET(request: Request, { params }: { params: any }) {
  try {
    const { id } = await params;
    if (!id) return new Response('Not found', { status: 404 });

    const product = await prisma.product.findUnique({
      where: { id },
      select: { image: true },
    });

    const raw = product?.image || '';
    if (!raw) return new Response('No image', { status: 404 });

    // A pasted http(s) URL is not ours to serve; point the browser at it.
    if (/^https?:\/\//i.test(raw)) {
      return Response.redirect(raw, 302);
    }

    const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(raw);
    if (!match) return new Response('Unsupported image', { status: 415 });

    const [, contentType, base64] = match;
    const bytes = Buffer.from(base64, 'base64');

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.length),
        // Safe to cache hard: the URL carries the product's updatedAt, so a
        // replaced photo arrives under a different URL.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('GET /api/products/[id]/image error:', error);
    return new Response('Failed to load the image', { status: 500 });
  }
}
