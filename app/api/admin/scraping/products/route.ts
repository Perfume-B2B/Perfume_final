import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await auth().catch(() => null);
  const isDev = process.env.NODE_ENV !== 'production';
  if (!session || session.user.role !== 'ADMIN') {
    if (!isDev) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  const { searchParams } = new URL(request.url);
  const supplierId = searchParams.get('supplierId');
  const ids = searchParams.get('ids');

  const where: any = {};
  if (supplierId) where.supplierId = supplierId;
  if (ids) where.id = { in: ids.split(',') };

  const products = await prisma.normalizedProduct.findMany({ where, take: 1000 });
  return NextResponse.json({ products });
}
