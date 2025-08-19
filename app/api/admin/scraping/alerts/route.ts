import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const alerts = await prisma.scrapingAlert.findMany({ orderBy: { createdAt: 'desc' }, take: limit }).catch(() => []);
  return NextResponse.json({ alerts });
}


