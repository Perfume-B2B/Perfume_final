import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const sources = await prisma.priceScrapingSource.findMany({
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
    return NextResponse.json({ sources });
  } catch (e) {
    console.error('GET /api/admin/scraping/sources failed', e);
    return NextResponse.json({ error: 'Failed to load sources' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { sources } = await request.json();
    if (!Array.isArray(sources)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await prisma.$transaction(
      sources.map((s: any) =>
        prisma.priceScrapingSource.update({
          where: { id: s.id },
          data: {
            isActive: !!s.isActive,
            priority: Number.isFinite(s.priority) ? s.priority : 1,
            rateLimit: Number.isFinite(s.rateLimit) ? s.rateLimit : 1000,
            // persist extended configuration
            config: s.config
              ? s.config
              : {
                  headers: s.headers || undefined,
                  delay: s.delay || undefined,
                  useHeadless: s.useHeadless ?? true,
                  regionPriority: s.regionPriority || ['NL', 'BE', 'DE', 'FR'],
                  includeVAT: s.includeVAT ?? true,
                  includeShipping: s.includeShipping ?? true,
                  allowDomains: s.allowDomains || [],
                  denyDomains: s.denyDomains || [],
                  selectors: s.selectors || {},
                  proxyUrl: s.proxyUrl || undefined,
                },
          },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/admin/scraping/sources failed', e);
    return NextResponse.json({ error: 'Failed to save sources' }, { status: 500 });
  }
}
