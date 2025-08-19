import { BaseScraper } from './scrapers/BaseScraper';
import { BolComScraper } from './scrapers/BolComScraper';
import { AmazonNLScraper } from './scrapers/AmazonNLScraper';
import { HouseOfNicheScraper } from './scrapers/HouseOfNicheScraper';
import { 
  ScrapingSource, 
  PriceScrapingResult, 
  NormalizedProductData,
  ScrapingJob,
  ScrapingJobConfig 
} from './types';
import { ProductMatcher } from './matching/ProductMatcher';
import { Decimal } from '@prisma/client/runtime/library';

type UpdateJobCallback = (
  jobId: string,
  status: string,
  updates: Partial<ScrapingJob>
) => Promise<void> | void;

type SaveResultsCallback = (
  productId: string,
  sourceResults: PriceScrapingResult[]
) => Promise<void> | void;

export class ScrapingManager {
  private scrapers: Map<string, BaseScraper> = new Map();
  private matcher: ProductMatcher;
  private isRunning = false;
  private currentJob: ScrapingJob | null = null;
  private onUpdateJob?: UpdateJobCallback;
  private onSaveResults?: SaveResultsCallback;

  constructor(options?: { onUpdateJob?: UpdateJobCallback; onSaveResults?: SaveResultsCallback }) {
    this.matcher = new ProductMatcher();
    this.onUpdateJob = options?.onUpdateJob;
    this.onSaveResults = options?.onSaveResults;
  }

  /**
   * Initialize scrapers based on available sources
   */
  async initializeScrapers(sources: ScrapingSource[]): Promise<void> {
    try {
      for (const source of sources) {
        if (!source.isActive) continue;

        let scraper: BaseScraper;

        switch (source.name.toLowerCase()) {
          case 'bol.com':
            scraper = new BolComScraper(source);
            break;
          case 'amazon netherlands':
          case 'amazon nl':
            scraper = new AmazonNLScraper(source);
            break;
          case 'house of niche':
            scraper = new HouseOfNicheScraper(source);
            break;
          // Add more scrapers here as they are implemented
          default:
            console.warn(`No scraper implementation found for source: ${source.name}`);
            continue;
        }

        this.scrapers.set(source.id, scraper);
        console.log(`Initialized scraper for ${source.name}`);
      }
    } catch (error) {
      console.error('Error initializing scrapers:', error);
      throw error;
    }
  }

  /**
   * Start a scraping job
   */
  async startScrapingJob(
    job: ScrapingJob,
    normalizedProducts: NormalizedProductData[]
  ): Promise<void> {
    if (this.isRunning) {
      throw new Error('Scraping job already in progress');
    }

    this.isRunning = true;
    this.currentJob = job;

    try {
      console.log(`Starting scraping job: ${job.name}`);
      console.log(`Total products to process: ${normalizedProducts.length}`);

      // Update job status
      await this.updateJobStatus(job.id!, 'RUNNING', {
        totalProducts: normalizedProducts.length,
        processedProducts: 0,
        successfulProducts: 0,
        failedProducts: 0,
        startedAt: new Date()
      });

      // Process products in batches
      const batchSize = job.config.batchSize || 10;
      const batches = this.createBatches(normalizedProducts, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} products)`);

        // Process batch
        const batchResults = await this.processBatch(batch, job.config.sources || []);

        // Update progress
        const processedCount = (i + 1) * batchSize;
        await this.updateJobStatus(job.id!, 'RUNNING', {
          processedProducts: Math.min(processedCount, normalizedProducts.length),
          successfulProducts: batchResults.successful,
          failedProducts: batchResults.failed
        });

        // Wait between batches
        if (i < batches.length - 1) {
          await this.delay(job.config.delayBetweenBatches || 5000);
        }
      }

      // Mark job as completed
      await this.updateJobStatus(job.id!, 'COMPLETED', {
        completedAt: new Date()
      });

      console.log(`Scraping job completed: ${job.name}`);

    } catch (error) {
      console.error(`Error in scraping job ${job.name}:`, error);
      
      // Mark job as failed
      await this.updateJobStatus(job.id!, 'FAILED', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    } finally {
      this.isRunning = false;
      this.currentJob = null;
    }
  }

  /**
   * Process a batch of products
   */
  private async processBatch(
    products: NormalizedProductData[],
    sourceIds: string[]
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    const activeScrapers = Array.from(this.scrapers.entries())
      .filter(([id]) => sourceIds.includes(id))
      .sort(([, a], [, b]) => {
        const sourceA = a.getSourceConfig();
        const sourceB = b.getSourceConfig();
        return (sourceB.priority || 1) - (sourceA.priority || 1);
      });

    for (const product of products) {
      try {
        const productResults: PriceScrapingResult[] = [];

        // Scrape from each active source
        for (const [sourceId, scraper] of activeScrapers) {
          try {
            const searchTerm = this.buildSearchTerm(product);
            const scrapedData = await scraper.scrapeProduct(searchTerm);

            if (scrapedData) {
              const priceResult = this.convertToPriceResult(scrapedData, product.id!, sourceId);
              // Apply allow/deny domain filters if configured on the source
              const cfg = scraper.getSourceConfig() as any;
              const urlHost = this.safeGetHost(priceResult.url);
              if (cfg?.allowDomains && Array.isArray(cfg.allowDomains) && cfg.allowDomains.length > 0) {
                if (!cfg.allowDomains.some((d: string) => urlHost.endsWith(d))) {
                  continue;
                }
              }
              if (cfg?.denyDomains && Array.isArray(cfg.denyDomains) && cfg.denyDomains.length > 0) {
                if (cfg.denyDomains.some((d: string) => urlHost.endsWith(d))) {
                  continue;
                }
              }
              productResults.push(priceResult);
            }

            // Wait for rate limiting
            await this.delay(1000);

          } catch (error) {
            console.warn(`Failed to scrape product ${product.id} from source ${sourceId}:`, error);
            continue;
          }
        }

        // Use matching engine to find best matches
        if (productResults.length > 0) {
          const matches = this.matcher.findMatches(product, productResults);

          // Persist top results if callback provided
          const sorted = [...matches.scrapedResults].sort((a, b) => {
            const ap = typeof a.price === 'object' && a.price !== null ? parseFloat(a.price.toString()) : (a.price as unknown as number);
            const bp = typeof b.price === 'object' && b.price !== null ? parseFloat(b.price.toString()) : (b.price as unknown as number);
            return ap - bp;
          });
          const topThree = sorted.slice(0, 3).map((r, idx) => ({
            ...r,
            isLowestPrice: idx === 0,
          }));

          if (this.onSaveResults) {
            await this.onSaveResults(product.id!, topThree);
          }

          successful++;
        } else {
          console.log(`No matches found for product ${product.id}`);
          failed++;
        }

      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error);
        failed++;
      }
    }

    return { successful, failed };
  }

  /**
   * Build search term for a product
   */
  private buildSearchTerm(product: NormalizedProductData): string {
    const parts = [];
    
    if (product.brand) parts.push(product.brand);
    if (product.productName) parts.push(product.productName);
    if (product.variantSize) parts.push(product.variantSize);
    
    return parts.join(' ').trim();
  }

  /**
   * Convert scraped data to price result format
   */
  private convertToPriceResult(
    scrapedData: any, 
    productId: string, 
    sourceId: string
  ): PriceScrapingResult {
    return {
      id: `result_${Date.now()}_${Math.random()}`,
      normalizedProductId: productId,
      sourceId,
      productTitle: scrapedData.title,
      merchant: scrapedData.merchant,
      url: scrapedData.url,
      price: scrapedData.price,
      priceInclVat: true, // Default assumption
      shippingCost: scrapedData.shippingCost,
      availability: scrapedData.availability,
      confidenceScore: 0.8, // Default confidence, would be calculated by matcher
      isLowestPrice: false, // Would be determined after all results
      scrapedAt: scrapedData.scrapedAt,
      jobId: this.currentJob?.id
    };
  }

  private safeGetHost(url: string): string {
    try {
      return new URL(url).host || '';
    } catch {
      return '';
    }
  }

  /**
   * Create batches for processing
   */
  private createBatches(
    products: NormalizedProductData[], 
    batchSize: number
  ): NormalizedProductData[][] {
    const batches = [];
    for (let i = 0; i < products.length; i += batchSize) {
      batches.push(products.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Update job status (placeholder - would integrate with database)
   */
  private async updateJobStatus(
    jobId: string, 
    status: string, 
    updates: Partial<ScrapingJob>
  ): Promise<void> {
    if (this.onUpdateJob) {
      await this.onUpdateJob(jobId, status, updates);
      return;
    }
    console.log(`Job ${jobId} status: ${status}`, updates);
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop current job
   */
  async stopCurrentJob(): Promise<void> {
    if (!this.isRunning || !this.currentJob) {
      throw new Error('No job currently running');
    }

    console.log(`Stopping job: ${this.currentJob.name}`);
    
    // Mark job as stopped
    await this.updateJobStatus(this.currentJob.id!, 'STOPPED', {
      completedAt: new Date()
    });

    this.isRunning = false;
    this.currentJob = null;
  }

  /**
   * Get current job status
   */
  getCurrentJob(): ScrapingJob | null {
    return this.currentJob;
  }

  /**
   * Check if job is running
   */
  isJobRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get scraper health status
   */
  async getScraperHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [sourceId, scraper] of this.scrapers) {
      try {
        health[sourceId] = await scraper.healthCheck();
      } catch (error) {
        health[sourceId] = false;
      }
    }

    return health;
  }

  /**
   * Get available scrapers
   */
  getAvailableScrapers(): string[] {
    return Array.from(this.scrapers.keys());
  }
}
