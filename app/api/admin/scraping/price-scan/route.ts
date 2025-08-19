import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PriceScanRequest, PriceScanResponse } from '@/lib/scraping/types';
import { prisma } from '@/lib/prisma';
import { ScrapingManager } from '@/lib/scraping/ScrapingManager';

// Use shared prisma client

export async function POST(request: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const isDev = process.env.NODE_ENV !== 'production';
    if (!session || session.user.role !== 'ADMIN') {
      if (!isDev) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body: PriceScanRequest = await request.json();
    const { supplierId, productIds, sources, priority, config } = body;

    if (!supplierId && (!productIds || productIds.length === 0)) {
      return NextResponse.json(
        { error: 'Either supplierId or productIds must be provided' },
        { status: 400 }
      );
    }

    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
      }
    }

    if (productIds && productIds.length > 0) {
      const products = await prisma.normalizedProduct.findMany({ where: { id: { in: productIds } } });
      if (products.length !== productIds.length) {
        return NextResponse.json({ error: 'Some products not found' }, { status: 404 });
      }
    }

    if (sources && sources.length > 0) {
      const activeSources = await prisma.priceScrapingSource.findMany({
        where: { id: { in: sources }, isActive: true },
      });
      if (activeSources.length !== sources.length) {
        return NextResponse.json({ error: 'Some sources are not active' }, { status: 400 });
      }
    }

    // Resolve products to process
    const productsToProcess = await prisma.normalizedProduct.findMany({
      where: supplierId ? { supplierId } : { id: { in: productIds || [] } },
      select: {
        id: true,
        supplierId: true,
        brand: true,
        productName: true,
        variantSize: true,
        ean: true,
        wholesalePrice: true,
        currency: true,
        packSize: true,
        supplierName: true,
        lastPurchasePrice: true,
        availability: true,
        notes: true,
      },
    });

    if (productsToProcess.length === 0) {
      return NextResponse.json(
        { error: 'No normalized products found for the selected supplier' },
        { status: 400 }
      );
    }

    // Create job in DB
    const job = await prisma.priceScrapingJob.create({
      data: {
        name: `Price Scan - ${supplierId ? `Supplier ${supplierId}` : `${productsToProcess.length} Products`}`,
        description: `Price scanning job initiated by ${session?.user?.username ?? 'dev'}`,
        status: 'PENDING',
        supplierId: supplierId || null,
        totalProducts: productsToProcess.length,
        processedProducts: 0,
        successfulProducts: 0,
        failedProducts: 0,
        config: {
          sources: sources || [],
          priority: priority || 'NORMAL',
          batchSize: config?.batchSize || 10,
          delayBetweenBatches: config?.delayBetweenBatches || 5000,
          maxRetries: config?.maxRetries || 3,
          confidenceThreshold: config?.confidenceThreshold || 0.7,
          ...config,
        },
      },
    });

    // Initialize scrapers and run asynchronously (do not block request)
    const manager = new ScrapingManager({
      onUpdateJob: async (jobId, status, updates) => {
        await prisma.priceScrapingJob.update({ where: { id: jobId }, data: { status: status as any, ...updates } });
      },
      onSaveResults: async (_productId, topResults) => {
        // Persist results
        for (const r of topResults) {
          await prisma.priceScrapingResult.create({
            data: {
              normalizedProductId: r.normalizedProductId,
              sourceId: r.sourceId,
              productTitle: r.productTitle,
              merchant: r.merchant,
              url: r.url,
              price: typeof r.price === 'object' && r.price !== null ? parseFloat(r.price.toString()) : (r.price as unknown as number),
              priceInclVat: r.priceInclVat,
              shippingCost:
                r.shippingCost != null
                  ? typeof r.shippingCost === 'object' && r.shippingCost !== null
                    ? parseFloat(r.shippingCost.toString())
                    : (r.shippingCost as unknown as number)
                  : null,
              availability: r.availability as any,
              confidenceScore:
                typeof r.confidenceScore === 'object' && r.confidenceScore !== null
                  ? parseFloat(r.confidenceScore.toString())
                  : (r.confidenceScore as unknown as number),
              isLowestPrice: r.isLowestPrice ?? false,
              scrapedAt: new Date(),
              jobId: job.id,
            },
          });
        }
      },
    });

    const activeSources = await prisma.priceScrapingSource.findMany({
      where: sources && sources.length > 0 ? { id: { in: sources }, isActive: true } : { isActive: true },
    });

    // Kick off the job without waiting
    manager
      .initializeScrapers(activeSources)
      .then(() => manager.startScrapingJob({ ...job, config: job.config as any } as any, productsToProcess as any))
      .catch(async (err) => {
        console.error('Scraping job failed to start:', err);
        await prisma.priceScrapingJob.update({ where: { id: job.id }, data: { status: 'FAILED', errorMessage: String(err) } });
      });

    const response: PriceScanResponse = {
      success: true,
      jobId: job.id,
      estimatedDuration: Math.ceil((productsToProcess.length * (sources?.length || activeSources.length || 1) * 2) / 60),
      totalProducts: productsToProcess.length,
      jobStatus: job.status,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in price-scan endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const isDev = process.env.NODE_ENV !== 'production';
    if (!session || session.user.role !== 'ADMIN') {
      if (!isDev) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const supplierId = searchParams.get('supplierId');
    const status = searchParams.get('status');

    if (jobId) {
      const job = await prisma.priceScrapingJob.findUnique({
        where: { id: jobId },
        include: {
          supplier: true,
          priceResults: { take: 10, orderBy: { scrapedAt: 'desc' } },
        },
      });
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      return NextResponse.json({
        success: true,
        job: {
          id: job.id,
          name: job.name,
          status: job.status,
          totalProducts: job.totalProducts,
          processedProducts: job.processedProducts,
          successfulProducts: job.successfulProducts,
          failedProducts: job.failedProducts,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          errorMessage: job.errorMessage,
          config: job.config,
          supplier: job.supplier,
          recentResults: job.priceResults,
        },
      });
    }

    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;

    const jobs = await prisma.priceScrapingJob.findMany({
      where,
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        totalProducts: job.totalProducts,
        processedProducts: job.processedProducts,
        successfulProducts: job.successfulProducts,
        failedProducts: job.failedProducts,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        supplier: job.supplier,
        createdAt: job.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error in price-scan GET endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
