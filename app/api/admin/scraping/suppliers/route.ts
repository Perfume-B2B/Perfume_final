import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Soft auth: allow in dev even if not logged in
    await auth().catch(() => null);
    const suppliers = await prisma.supplier
      .findMany({ orderBy: { name: 'asc' } })
      .catch(() => []);
    return NextResponse.json({ suppliers });
  } catch (e: any) {
    console.error('GET /api/admin/scraping/suppliers failed', e);
    return NextResponse.json({ error: e?.message || 'Failed to load suppliers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Soft auth for development
    await auth().catch(() => null);
    const body = await request.json();
    const { name, country = 'NL', currency = 'EUR', email, website } = body || {};
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const supplier = await prisma.supplier.create({
      data: { name, country, currency, email: email || null, website: website || null },
    });
    return NextResponse.json({ supplier });
  } catch (e: any) {
    console.error('POST /api/admin/scraping/suppliers failed', e);
    return NextResponse.json({ error: e?.message || 'Failed to create supplier' }, { status: 500 });
  }
}
