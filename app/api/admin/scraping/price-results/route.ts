import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batch_id');
    const jobId = searchParams.get('jobId');
    const supplierId = searchParams.get('supplierId');
    const sourceId = searchParams.get('sourceId');
    const minConfidence = searchParams.get('minConfidence');
    const minMargin = searchParams.get('minMargin');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = searchParams.get('sortBy') || 'scrapedAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const where: any = {};
    
    if (batchId) where.importSessionId = batchId;
    if (jobId) where.jobId = jobId;
    if (supplierId) {
      where.normalizedProduct = { supplierId };
    }
    if (sourceId) where.sourceId = sourceId;
    if (minConfidence) where.confidenceScore = { gte: parseFloat(minConfidence) };
    if (dateFrom || dateTo) {
      where.scrapedAt = {};
      if (dateFrom) where.scrapedAt.gte = new Date(dateFrom);
      if (dateTo) where.scrapedAt.lte = new Date(dateTo);
    }

    // Build order by clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // Get total count for pagination
    const totalCount = await prisma.priceScrapingResult.count({ where });

    // Get results with pagination
    const results = await prisma.priceScrapingResult.findMany({
      where,
      include: {
        normalizedProduct: {
          include: {
            supplier: true
          }
        },
        source: true,
        scrapingJob: true
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    });

    // Calculate analytics
    const analytics = await calculateAnalytics(where);

    return NextResponse.json({
      success: true,
      results,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      analytics
    });

  } catch (error) {
    console.error('Error in price-results endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function calculateAnalytics(where: any) {
  try {
    // Get total results count
    const totalResults = await prisma.priceScrapingResult.count({ where });
    
    if (totalResults === 0) {
      return {
        totalResults: 0,
        averagePrice: 0,
        averageConfidence: 0,
        highConfidenceCount: 0,
        opportunitiesCount: 0,
        sourcesCount: 0,
        productsCount: 0
      };
    }

    // Get average price and confidence
    const priceStats = await prisma.priceScrapingResult.aggregate({
      where,
      _avg: {
        price: true,
        confidenceScore: true
      }
    });

    // Get high confidence results (>= 0.8)
    const highConfidenceCount = await prisma.priceScrapingResult.count({
      where: {
        ...where,
        confidenceScore: { gte: 0.8 }
      }
    });

    // Get unique sources count
    const sourcesCount = await prisma.priceScrapingResult.groupBy({
      by: ['sourceId'],
      where,
      _count: true
    });

    // Get unique products count
    const productsCount = await prisma.priceScrapingResult.groupBy({
      by: ['normalizedProductId'],
      where,
      _count: true
    });

    // Calculate opportunities (where retail price is significantly higher than wholesale)
    // First get all results with their normalized products to check wholesale prices
    const opportunitiesQuery = await prisma.priceScrapingResult.findMany({
      where,
      include: {
        normalizedProduct: {
          select: {
            wholesalePrice: true
          }
        }
      }
    });

    let opportunitiesCount = 0;
    for (const result of opportunitiesQuery) {
      if (result.normalizedProduct && result.normalizedProduct.wholesalePrice !== null && result.normalizedProduct.wholesalePrice !== undefined) {
        const wholesalePrice = parseFloat(result.normalizedProduct.wholesalePrice.toString());
        const retailPrice = parseFloat(result.price.toString());
        const margin = ((retailPrice - wholesalePrice) / wholesalePrice) * 100;
        if (margin >= 20) { // 20% margin threshold
          opportunitiesCount++;
        }
      }
    }

    return {
      totalResults,
      averagePrice: priceStats._avg.price || 0,
      averageConfidence: priceStats._avg.confidenceScore || 0,
      highConfidenceCount,
      opportunitiesCount,
      sourcesCount: sourcesCount.length,
      productsCount: productsCount.length
    };

  } catch (error) {
    console.error('Error calculating analytics:', error);
    return {
      totalResults: 0,
      averagePrice: 0,
      averageConfidence: 0,
      highConfidenceCount: 0,
      opportunitiesCount: 0,
      sourcesCount: 0,
      productsCount: 0
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { results } = body;

    if (!results || !Array.isArray(results)) {
      return NextResponse.json(
        { error: 'Invalid results data' },
        { status: 400 }
      );
    }

    // Save price scraping results to database with outlier filtering and alerts
    const savedResults = [] as any[];
    // Compute median price for outlier filtering (based on incoming batch)
    const numericPrices = results
      .map((r: any) => parseFloat(r.price))
      .filter((n: number) => Number.isFinite(n))
      .sort((a: number, b: number) => a - b);
    const median =
      numericPrices.length === 0
        ? 0
        : numericPrices.length % 2
        ? numericPrices[(numericPrices.length - 1) / 2]
        : (numericPrices[numericPrices.length / 2 - 1] + numericPrices[numericPrices.length / 2]) / 2;
    const outlierThreshold = 3; // 3x median considered outlier
    for (const result of results) {
      try {
        const priceNum = parseFloat(result.price);
        if (median > 0 && priceNum > outlierThreshold * median) {
          // skip extreme outliers
          continue;
        }

        const savedResult = await prisma.priceScrapingResult.create({
          data: {
            normalizedProductId: result.normalizedProductId,
            sourceId: result.sourceId,
            productTitle: result.productTitle,
            merchant: result.merchant,
            url: result.url,
            price: priceNum,
            priceInclVat: result.priceInclVat,
            shippingCost: result.shippingCost ? parseFloat(result.shippingCost) : null,
            availability: result.availability,
            confidenceScore: parseFloat(result.confidenceScore),
            isLowestPrice: result.isLowestPrice,
            jobId: result.jobId,
            scrapedAt: result.scrapedAt ? new Date(result.scrapedAt) : new Date()
          }
        });
        savedResults.push(savedResult);

        // Create margin opportunity alert if threshold met
        try {
          const product = await prisma.normalizedProduct.findUnique({
            where: { id: result.normalizedProductId },
            select: { wholesalePrice: true },
          });
          const wholesale = product?.wholesalePrice ? parseFloat(product.wholesalePrice.toString()) : 0;
          if (wholesale > 0) {
            const marginPct = ((priceNum - wholesale) / wholesale) * 100;
            const target = 20; // default threshold; could be per-supplier in future
            if (marginPct >= target) {
              await prisma.scrapingAlert.create({
                data: {
                  normalizedProductId: result.normalizedProductId,
                  alertType: 'MARGIN_OPPORTUNITY',
                  message: `Margin ${marginPct.toFixed(1)}% ≥ ${target}%`,
                  currentMargin: marginPct,
                  targetMargin: target,
                },
              });
            }
          }
        } catch (e) {
          // best-effort, do not block saving
        }
      } catch (error) {
        console.error(`Error saving result for product ${result.normalizedProductId}:`, error);
        // Continue with other results
      }
    }

    return NextResponse.json({
      success: true,
      savedCount: savedResults.length,
      results: savedResults
    });

  } catch (error) {
    console.error('Error in price-results POST endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
