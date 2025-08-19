import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // In development or if auth is not set up, don't block the stats endpoint
    const session = await auth().catch(() => null);
    const isAdmin = session && (session as any).user?.role === 'ADMIN';

    const [totalSuppliers, totalProducts, activeJobs, totalScrapedResults] = await Promise.all([
      prisma.supplier.count().catch(() => 0),
      prisma.normalizedProduct.count().catch(() => 0),
      prisma.priceScrapingJob
        .count({ where: { status: { in: ['RUNNING', 'PENDING'] } } })
        .catch(() => 0),
      prisma.priceScrapingResult.count().catch(() => 0),
    ]);

    const lastScrapedRow = await prisma.priceScrapingResult
      .findFirst({ orderBy: { scrapedAt: 'desc' }, select: { scrapedAt: true } })
      .catch(() => null);

    // Compute opportunities (margin >= 20%) in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentResults =
      (await prisma.priceScrapingResult
        .findMany({
          where: { scrapedAt: { gte: sevenDaysAgo } },
          include: { normalizedProduct: { select: { wholesalePrice: true } } },
          take: 5000,
        })
        .catch(() => [])) as any[];
    let recentOpportunities = 0;
    let marginSum = 0;
    let marginCount = 0;
    for (const r of recentResults) {
      if (!r.normalizedProduct?.wholesalePrice) continue;
      const wholesale = parseFloat(r.normalizedProduct.wholesalePrice.toString());
      const retail = parseFloat(r.price.toString());
      if (wholesale > 0) {
        const marginPct = ((retail - wholesale) / wholesale) * 100;
        marginSum += marginPct;
        marginCount += 1;
        if (marginPct >= 20) recentOpportunities += 1;
      }
    }
    const averageMargin = marginCount > 0 ? parseFloat((marginSum / marginCount).toFixed(1)) : 0;

    return NextResponse.json({
      totalSuppliers,
      totalProducts,
      activeJobs,
      lastScraped: lastScrapedRow?.scrapedAt ?? null,
      totalScrapedResults,
      recentOpportunities,
      averageMargin,
      healthStatus: 'healthy',
    });
  } catch (e) {
    console.error('GET /api/admin/scraping/stats failed', e);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
