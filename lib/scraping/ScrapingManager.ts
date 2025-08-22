import { BaseScraper } from './scrapers/BaseScraper';
import { HouseOfNicheScraper } from './scrapers/HouseOfNicheScraper';
import { PlaywrightBaseScraper } from './scrapers/PlaywrightBaseScraper';
import { PlaywrightBolComScraper } from './scrapers/PlaywrightBolComScraper';
import { PlaywrightAmazonNLScraper } from './scrapers/PlaywrightAmazonNLScraper';
import { PlaywrightAmazonFRScraper } from './scrapers/PlaywrightAmazonFRScraper';
import { PlaywrightAmazonDEScraper } from './scrapers/PlaywrightAmazonDEScraper';
import { 
  ScrapingSource, 
  PriceScrapingResult, 
  NormalizedProductData,
  ScrapingJob
} from './types';
import { ProductMatcher } from './matching/ProductMatcher';


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
  private scrapers: Map<string, BaseScraper | PlaywrightBaseScraper> = new Map();
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

        let scraper: BaseScraper | PlaywrightBaseScraper;

        // Use Playwright for all scrapers (faster and more reliable)
        console.log(`🎭 Using Playwright for ${source.name} (optimized)`);

        switch (source.name.toLowerCase()) {
          case 'bol.com':
            scraper = new PlaywrightBolComScraper(source);
            break;
          case 'amazon netherlands':
          case 'amazon nl':
            scraper = new PlaywrightAmazonNLScraper(source);
            break;
          case 'amazon france':
          case 'amazon fr':
            scraper = new PlaywrightAmazonFRScraper(source);
            break;
          case 'amazon germany':
          case 'amazon de':
            scraper = new PlaywrightAmazonDEScraper(source);
            break;
          case 'house of niche':
            scraper = new HouseOfNicheScraper(source) as any; // Keep legacy scraper for now
            break;
          // Add more scrapers here as they are implemented
          default:
            console.warn(`No scraper implementation found for source: ${source.name}`);
            continue;
        }

        // Initialize the scraper (launch browser, create page) - one at a time for Vercel
        console.log(`[${sources.indexOf(source) + 1}/${sources.length}] Initializing scraper for ${source.name}...`);
        
        try {
          await scraper.initialize();
          console.log(`✅ [${sources.indexOf(source) + 1}/${sources.length}] Scraper initialized for ${source.name}`);
          
          this.scrapers.set(source.id, scraper);
          
          // Add delay between initializations to prevent Vercel overload
          if (sources.indexOf(source) < sources.length - 1) {
            console.log(`⏳ Waiting 2 seconds before next scraper...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`❌ Failed to initialize scraper for ${source.name}:`, error);
          // Continue with other scrapers instead of failing completely
          continue;
        }
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
      console.log(`Job config sources:`, job.config.sources);
      console.log(`Available scrapers:`, Array.from(this.scrapers.keys()));

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

        // Update batch progress
        await this.updateJobStatus(job.id!, 'RUNNING', {
          currentBatch: i + 1,
          totalBatches: batches.length,
          currentProduct: `Batch ${i + 1}/${batches.length}`
        });

        // Process batch
        const batchResults = await this.processBatch(batch, job.config.sources || []);

        // Update progress
        const processedCount = (i + 1) * batchSize;
        await this.updateJobStatus(job.id!, 'RUNNING', {
          processedProducts: Math.min(processedCount, normalizedProducts.length),
          successfulProducts: batchResults.successful,
          failedProducts: batchResults.failed
        });

        // Wait between batches (further optimized for speed)
        if (i < batches.length - 1) {
          await this.delay(job.config.delayBetweenBatches || 800);
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
      
      // Cleanup scrapers after job completion
      await this.cleanup();
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

    console.log(`Processing batch with ${products.length} products and ${sourceIds.length} sources:`, sourceIds);

    const activeScrapers = Array.from(this.scrapers.entries())
      .filter(([id]) => sourceIds.includes(id))
      .sort(([, a], [, b]) => {
        const sourceA = a.getSourceConfig();
        const sourceB = b.getSourceConfig();
        return (sourceB.priority || 1) - (sourceA.priority || 1);
      });

    console.log(`Active scrapers after filtering: ${activeScrapers.length}`, activeScrapers.map(([id]) => id));

    for (let productIndex = 0; productIndex < products.length; productIndex++) {
      const product = products[productIndex];
      try {
        // Update current product being processed with granular progress
        const currentProductInBatch = productIndex + 1;
        const totalProductsInBatch = products.length;
        
        await this.updateJobStatus(this.currentJob?.id!, 'RUNNING', {
          currentProduct: `${product.brand} ${product.productName} (${currentProductInBatch}/${totalProductsInBatch} in batch)`,
          currentSource: 'Starting...'
        });

        const productResults: PriceScrapingResult[] = [];

        // Scrape from each active source
        for (const [sourceId, scraper] of activeScrapers) {
          try {
            // Update current source being processed
            await this.updateJobStatus(this.currentJob?.id!, 'RUNNING', {
              currentSource: `Scraping from ${scraper.constructor.name.replace('Scraper', '')}`,
              currentSearchTerm: 'Preparing...'
            });

            // Try multiple search strategies for better results
            const searchTerms = this.buildSearchTerms(product);
            let scrapedData = null;
            let searchAttempts = 0;
            
            // Try each search term until one works
            for (const searchTerm of searchTerms) {
              searchAttempts++;
              try {
                console.log(`Trying search term: "${searchTerm}" for product ${product.id}`);
                
                // Update current search term being tried
                await this.updateJobStatus(this.currentJob?.id!, 'RUNNING', {
                  currentSearchTerm: `Trying: "${searchTerm}"`,
                  searchAttempts
                });

                scrapedData = await scraper.scrapeProduct(searchTerm);
                
                if (scrapedData) {
                  console.log(`✅ Found results with search term: "${searchTerm}"`);
                  break; // Success! Stop trying other terms
                }
              } catch (error) {
                console.log(`❌ Search term "${searchTerm}" failed, trying next...`);
                continue;
              }
            }

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

            // Wait for rate limiting (further optimized for speed)
            await this.delay(200);

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
   * Build search terms for a product
   * Generates multiple optimized search terms for better e-commerce matching
   */
  private buildSearchTerms(product: NormalizedProductData): string[] {
    // Strategy: Generate multiple search terms in order of preference
    const searchTerms: string[] = [];
    
    // 1. Extract core product name (remove common suffixes)
    let coreProductName = product.productName || '';
    
    // Remove common suffixes that make search terms too long
    const suffixesToRemove = [
      'Eau de Parfum',
      'Eau de Toilette', 
      'Eau de Cologne',
      'Parfum',
      'Toilette',
      'Cologne',
      'Spray',
      'Verstuiver'
    ];
    
    for (const suffix of suffixesToRemove) {
      coreProductName = coreProductName.replace(new RegExp(suffix, 'gi'), '').trim();
    }
    
    // 2. Clean up size information
    let size = product.variantSize || '';
    if (size === '1' || size === '1ml' || size === '1 ml') {
      size = ''; // Skip meaningless size values
    }
    
    // 3. Build optimized search terms in order of preference
    
    // Primary: Brand + Core Product Name (most effective)
    if (product.brand && coreProductName) {
      searchTerms.push(`${product.brand} ${coreProductName}`);
    }
    
    // Secondary: Brand + Core Product Name + Size (if size is meaningful)
    if (product.brand && coreProductName && size && size !== '1') {
      searchTerms.push(`${product.brand} ${coreProductName} ${size}`);
    }
    
    // Tertiary: Core Product Name + Brand (alternative order)
    if (coreProductName && product.brand) {
      searchTerms.push(`${coreProductName} ${product.brand}`);
    }
    
    // Quaternary: Just the core product name (for very specific products)
    if (coreProductName && coreProductName.length < 30) {
      searchTerms.push(coreProductName);
    }
    
    // Quinary: Brand only (fallback for very specific brands)
    if (product.brand && product.brand.length < 20) {
      searchTerms.push(product.brand);
    }
    
    // 4. Filter out terms that are too long or empty
    const validTerms = searchTerms.filter(term => 
      term && term.length > 0 && term.length < 50
    );
    
    // 5. If no valid terms, fallback to original logic
    if (validTerms.length === 0) {
      const parts = [];
      if (product.brand) parts.push(product.brand);
      if (product.productName) parts.push(product.productName);
      if (product.variantSize && product.variantSize !== '1') parts.push(product.variantSize);
      
      const fallbackTerm = parts.join(' ').trim();
      if (fallbackTerm) {
        validTerms.push(fallbackTerm);
      }
    }
    
    return validTerms;
  }

  /**
   * Build search term for a product (legacy method - kept for compatibility)
   */
  private buildSearchTerm(product: NormalizedProductData): string {
    const terms = this.buildSearchTerms(product);
    return terms[0] || '';
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
   * Update job status with detailed progress information
   */
  private async updateJobStatus(
    jobId: string, 
    status: string, 
    updates: Partial<ScrapingJob> & {
      currentProduct?: string;
      currentSource?: string;
      currentBatch?: number;
      totalBatches?: number;
      currentSearchTerm?: string;
      searchAttempts?: number;
    }
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

  /**
   * Cleanup all scrapers and close browsers
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up scrapers...');
    
    for (const [sourceId, scraper] of this.scrapers) {
      try {
        await scraper.cleanup();
        console.log(`✅ Cleaned up scraper for ${sourceId}`);
      } catch (error) {
        console.error(`❌ Error cleaning up scraper ${sourceId}:`, error);
      }
    }
    
    this.scrapers.clear();
    console.log('✅ All scrapers cleaned up');
  }

  /**
   * Stop the current scraping job
   */
  async stopJob(): Promise<void> {
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
        console.error(`Health check failed for ${sourceId}:`, error);
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

  /**
   * Cleanup all scrapers and close browsers
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up scrapers...');
    
    for (const [sourceId, scraper] of this.scrapers) {
      try {
        await scraper.cleanup();
        console.log(`✅ Cleaned up scraper for ${sourceId}`);
      } catch (error) {
        console.error(`❌ Error cleaning up scraper ${sourceId}:`, error);
      }
    }
    
    this.scrapers.clear();
    console.log('✅ All scrapers cleaned up');
  }

}


