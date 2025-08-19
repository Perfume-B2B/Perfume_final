import { BaseScraper } from './BaseScraper';
import { ScrapingSource, PriceScrapingResult } from '../types';
import { Decimal } from '@prisma/client/runtime/library';

export class BolComScraper extends BaseScraper {
  constructor(source: ScrapingSource) {
    super(source);
  }

  /**
   * Search for products on Bol.com
   */
  async searchProducts(query: string): Promise<any[]> {
    try {
      await this.initialize();
      
      // Navigate to Bol.com search page
      const searchUrl = `https://www.bol.com/nl/nl/zoekresultaten.html?searchtext=${encodeURIComponent(query)}`;
      await this.navigateToUrl(searchUrl);
      
      // Wait for search results to load
      await this.waitForSelector('[data-testid="product-grid"]', 10000);
      
      // Extract product information
      const products = await this.extractSearchResults();
      
      // Wait for rate limiting
      await this.waitForRateLimit();
      
      return products;
    } catch (error) {
      console.error(`Error searching products on Bol.com: ${error}`);
      return [];
    }
  }

  /**
   * Scrape a specific product page
   */
  async scrapeProduct(searchTerm: string): Promise<any> {
    try {
      await this.initialize();
      
      // Search for the product first
      const searchResults = await this.searchProducts(searchTerm);
      
      if (searchResults.length === 0) {
        return null;
      }
      
      // Get the first (most relevant) result
      const firstResult = searchResults[0];
      
      // Navigate to the product page
      if (firstResult.url) {
        await this.navigateToUrl(firstResult.url);
        await this.waitForSelector('[data-testid="product-title"]', 10000);
        
        // Extract detailed product information
        const productDetails = await this.extractProductDetails();
        
        return {
          ...firstResult,
          ...productDetails
        };
      }
      
      return firstResult;
    } catch (error) {
      console.error(`Error scraping product on Bol.com: ${error}`);
      return null;
    }
  }

  /**
   * Extract search results from the search page
   */
  private async extractSearchResults(): Promise<any[]> {
    try {
      const products = await this.page!.evaluate(() => {
        const productElements = document.querySelectorAll('[data-testid="product-item"]');
        
        return Array.from(productElements).map((element, index) => {
          // Extract product title
          const titleElement = element.querySelector('[data-testid="product-title"]');
          const title = titleElement?.textContent?.trim() || '';
          
          // Extract price
          const priceElement = element.querySelector('[data-testid="price"]');
          const priceText = priceElement?.textContent?.trim() || '';
          const price = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
          
          // Extract URL
          const linkElement = element.querySelector('a[href*="/p/"]');
          const url = linkElement?.getAttribute('href') || '';
          const fullUrl = url.startsWith('http') ? url : `https://www.bol.com${url}`;
          
          // Extract availability
          const availabilityElement = element.querySelector('[data-testid="availability"]');
          const availability = availabilityElement?.textContent?.toLowerCase().includes('op voorraad') || false;
          
          // Extract merchant (Bol.com or marketplace seller)
          const merchantElement = element.querySelector('[data-testid="seller"]');
          const merchant = merchantElement?.textContent?.trim() || 'Bol.com';
          
          return {
            title,
            price,
            url: fullUrl,
            availability,
            merchant,
            source: 'Bol.com'
          };
        });
      });
      
      return products.filter(p => p.title && p.price > 0);
    } catch (error) {
      console.error('Error extracting search results:', error);
      return [];
    }
  }

  /**
   * Extract detailed product information from product page
   */
  private async extractProductDetails(): Promise<any> {
    try {
      const details = await this.page!.evaluate(() => {
        // Extract detailed title
        const titleElement = document.querySelector('[data-testid="product-title"]');
        const title = titleElement?.textContent?.trim() || '';
        
        // Extract price
        const priceElement = document.querySelector('[data-testid="price"]');
        const priceText = priceElement?.textContent?.trim() || '';
        const price = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        
        // Extract availability
        const availabilityElement = document.querySelector('[data-testid="availability"]');
        const availability = availabilityElement?.textContent?.toLowerCase().includes('op voorraad') || false;
        
        // Extract shipping information
        const shippingElement = document.querySelector('[data-testid="shipping"]');
        const shippingText = shippingElement?.textContent?.trim() || '';
        const shippingCost = shippingText.includes('gratis') ? 0 : 
          parseFloat(shippingText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        
        // Extract merchant
        const merchantElement = document.querySelector('[data-testid="seller"]');
        const merchant = merchantElement?.textContent?.trim() || 'Bol.com';
        
        // Extract EAN if available
        const eanElement = document.querySelector('[data-testid="ean"]');
        const ean = eanElement?.textContent?.trim() || '';
        
        return {
          title,
          price,
          availability,
          shippingCost,
          merchant,
          ean
        };
      });
      
      return details;
    } catch (error) {
      console.error('Error extracting product details:', error);
      return {};
    }
  }

  /**
   * Convert scraped data to PriceScrapingResult format
   */
  convertToPriceResult(scrapedData: any, normalizedProductId: string): PriceScrapingResult {
    return {
      normalizedProductId,
      sourceId: this.source.id || '',
      productTitle: scrapedData.title || '',
      merchant: scrapedData.merchant || 'Bol.com',
      url: scrapedData.url || '',
      price: new Decimal(scrapedData.price || 0),
      currency: 'EUR',
      priceInclVat: true, // Bol.com prices include VAT
      shippingCost: scrapedData.shippingCost ? new Decimal(scrapedData.shippingCost) : undefined,
      availability: scrapedData.availability || false,
      confidenceScore: new Decimal(this.calculateConfidenceScore(scrapedData)),
      isLowestPrice: false, // Will be determined by matching engine
      scrapedAt: new Date()
    };
  }

  /**
   * Calculate confidence score for the scraped data
   */
  private calculateConfidenceScore(scrapedData: any): number {
    let score = 0.5; // Base score
    
    // Title quality
    if (scrapedData.title && scrapedData.title.length > 10) {
      score += 0.2;
    }
    
    // Price validity
    if (scrapedData.price && scrapedData.price > 0) {
      score += 0.2;
    }
    
    // Availability information
    if (scrapedData.availability !== undefined) {
      score += 0.1;
    }
    
    // URL validity
    if (scrapedData.url && scrapedData.url.includes('/p/')) {
      score += 0.1;
    }
    
    // EAN presence (if available)
    if (scrapedData.ean && scrapedData.ean.length >= 8) {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Check if the page is a valid product page
   */
  private async isValidProductPage(): Promise<boolean> {
    try {
      const title = await this.extractText('[data-testid="product-title"]');
      const price = await this.extractText('[data-testid="price"]');
      
      return title.length > 0 && price.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle pagination for search results
   */
  async getNextPageResults(): Promise<any[]> {
    try {
      const nextButton = await this.page!.$('[data-testid="pagination-next"]');
      if (!nextButton) {
        return []; // No more pages
      }
      
      await nextButton.click();
      await this.waitForSelector('[data-testid="product-grid"]', 10000);
      
      return await this.extractSearchResults();
    } catch (error) {
      console.error('Error getting next page results:', error);
      return [];
    }
  }

  /**
   * Get all search results across multiple pages
   */
  async getAllSearchResults(query: string, maxPages: number = 3): Promise<any[]> {
    try {
      await this.initialize();
      
      const allResults: any[] = [];
      let currentPage = 1;
      
      // Get first page results
      const searchUrl = `https://www.bol.com/nl/nl/zoekresultaten.html?searchtext=${encodeURIComponent(query)}`;
      await this.navigateToUrl(searchUrl);
      await this.waitForSelector('[data-testid="product-grid"]', 10000);
      
      let pageResults = await this.extractSearchResults();
      allResults.push(...pageResults);
      
      // Get additional pages
      while (currentPage < maxPages && pageResults.length > 0) {
        pageResults = await this.getNextPageResults();
        if (pageResults.length > 0) {
          allResults.push(...pageResults);
          currentPage++;
          await this.waitForRateLimit();
        } else {
          break;
        }
      }
      
      return allResults;
    } catch (error) {
      console.error('Error getting all search results:', error);
      return [];
    }
  }
}
