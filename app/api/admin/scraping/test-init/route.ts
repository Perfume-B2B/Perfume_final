import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ScrapingManager } from '@/lib/scraping/ScrapingManager';

export async function POST(request: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const isDev = process.env.NODE_ENV !== 'production';
    if (!session || session.user.role !== 'ADMIN') {
      if (!isDev) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('🧪 Starting scraper initialization test...');
    
    // Get one active source for testing
    const activeSources = await prisma.priceScrapingSource.findMany({
      where: { isActive: true },
      take: 1
    });
    
    if (activeSources.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active sources found' 
      });
    }

    const startTime = Date.now();
    const manager = new ScrapingManager();
    
    try {
      console.log(`🚀 Testing initialization with source: ${activeSources[0].name}`);
      
      // Test initialization with timeout
      const initPromise = manager.initializeScrapers(activeSources);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Initialization timeout (30s)')), 30000)
      );
      
      await Promise.race([initPromise, timeoutPromise]);
      
      const elapsed = Date.now() - startTime;
      console.log(`✅ Initialization successful in ${elapsed}ms`);
      
      // Cleanup
      await manager.cleanup();
      
      return NextResponse.json({ 
        success: true, 
        message: `Scraper initialized successfully in ${elapsed}ms`,
        source: activeSources[0].name,
        elapsed
      });
      
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ Initialization failed after ${elapsed}ms:`, error);
      
      // Cleanup
      await manager.cleanup();
      
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Unknown error',
        elapsed,
        source: activeSources[0].name
      });
    }
    
  } catch (error) {
    console.error('Error in test-init endpoint:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
