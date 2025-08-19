import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ScrapingManager } from '@/lib/scraping/ScrapingManager';

// This endpoint can be called by Vercel Cron nightly
export async function GET() {
  try {
    // Load active sources and a batch of products per supplier
    const sources = await prisma.priceScrapingSource.findMany({ where: { isActive: true } });
    const suppliers = await prisma.supplier.findMany({ where: { isActive: true }, select: { id: true, name: true } });

    let queued = 0;
    for (const supplier of suppliers) {
      const products = await prisma.normalizedProduct.findMany({ where: { supplierId: supplier.id }, take: 100 });
      if (products.length === 0) continue;

      const job = await prisma.priceScrapingJob.create({
        data: {
          name: `Nightly Scan - ${supplier.name}`,
          status: 'PENDING',
          supplierId: supplier.id,
          totalProducts: products.length,
          config: { sources: sources.map((s) => s.id), batchSize: 10, delayBetweenBatches: 5000, maxRetries: 2, confidenceThreshold: 0.7 },
        },
      });

      const manager = new ScrapingManager({
        onUpdateJob: async (jobId, status, updates) => {
          await prisma.priceScrapingJob.update({ where: { id: jobId }, data: { status: status as any, ...updates } });
        },
        onSaveResults: async (_pid, results) => {
          for (const r of results) {
            await prisma.priceScrapingResult.create({
              data: {
                normalizedProductId: r.normalizedProductId,
                sourceId: r.sourceId,
                productTitle: r.productTitle,
                merchant: r.merchant,
                url: r.url,
                price: typeof r.price === 'object' ? parseFloat(r.price.toString()) : (r.price as unknown as number),
                priceInclVat: r.priceInclVat,
                shippingCost: r.shippingCost ? (typeof r.shippingCost === 'object' ? parseFloat(r.shippingCost.toString()) : (r.shippingCost as unknown as number)) : null,
                availability: r.availability as any,
                confidenceScore: typeof r.confidenceScore === 'object' ? parseFloat(r.confidenceScore.toString()) : (r.confidenceScore as unknown as number),
                isLowestPrice: r.isLowestPrice ?? false,
                scrapedAt: new Date(),
                jobId: job.id,
              },
            });
          }
        },
      });

      await manager.initializeScrapers(sources);
      manager.startScrapingJob({ ...job, config: job.config as any } as any, products as any).catch(async (err) => {
        await prisma.priceScrapingJob.update({ where: { id: job.id }, data: { status: 'FAILED', errorMessage: String(err) } });
      });
      queued++;
    }

    return NextResponse.json({ queued });
  } catch (e: any) {
    console.error('Nightly cron failed', e);
    return NextResponse.json({ error: e?.message || 'cron failed' }, { status: 500 });
  }
}


