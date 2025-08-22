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
      
      // Navigate to Bol.com search page - Updated URL format
      const searchUrl = `https://www.bol.com/nl/nl/s?searchtext=${encodeURIComponent(query)}`;
      console.log(`🔍 Bol.com: Searching for "${query}"`);
      console.log(`🔗 Bol.com: URL = ${searchUrl}`);
      
      await this.navigateToUrl(searchUrl);
      console.log(`✅ Bol.com: Navigation completed`);
      
      // Wait for page to load (optimized)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check page title
      const pageTitle = await this.page.title();
      console.log(`📄 Bol.com: Page title = "${pageTitle}"`);
      
      // Check current URL
      const currentUrl = this.page.url();
      console.log(`🔗 Bol.com: Current URL = ${currentUrl}`);
      
      // Check page content length
      const pageContent = await this.page.content();
      console.log(`📝 Bol.com: Page content length = ${pageContent.length} characters`);
      
      // Check for anti-bot protection or CAPTCHA
      const bodyText = await this.page.evaluate(() => document.body.innerText);
      console.log(`📝 Bol.com: Body text length = ${bodyText.length} characters`);
      
      if (bodyText.toLowerCase().includes('captcha') || bodyText.toLowerCase().includes('robot')) {
        console.warn('⚠️ Bol.com: Anti-bot protection detected');
        return [];
      }
      
      // Try multiple selectors for product grid - Updated for 2024
      const gridSelectors = [
        '[data-testid="product-grid"]',
        '.product-grid',
        '.search-results',
        '.product-list',
        '.js_search_result_container',
        '.search-result-list',
        '.js_listpage',
        '[data-test="search-results"]'
      ];
      
      let gridFound = false;
      for (const selector of gridSelectors) {
        try {
          await this.waitForSelector(selector, 2000);
          console.log(`✅ Bol.com: Grid selector "${selector}" found`);
          gridFound = true;
          break;
        } catch (e) {
          console.log(`❌ Bol.com: Grid selector "${selector}" failed`);
        }
      }
      
      if (!gridFound) {
        console.log(`❌ Bol.com: No valid grid selectors found`);
        
        // Debug: Check what elements are actually on the page
        const allElements = await this.page.$$eval('*[data-testid], *[class*="product"], *[class*="search"], *[class*="result"]', (elements) => {
          return elements.slice(0, 20).map(el => ({
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            dataTestId: el.getAttribute('data-testid')
          }));
        });
        
        console.log(`🔍 Bol.com: Found ${allElements.length} potentially relevant elements:`);
        allElements.forEach(el => {
          console.log(`    ${el.tagName}${el.className ? '.' + el.className : ''}${el.id ? '#' + el.id : ''}${el.dataTestId ? '[data-testid="' + el.dataTestId + '"]' : ''}`);
        });
      }
      
      // Extract product information
      const products = await this.extractSearchResults();
      console.log(`🎯 Bol.com: Successfully extracted ${products.length} products`);
      
      // Wait for rate limiting
      await this.waitForRateLimit();
      
      return products;
    } catch (error) {
      console.error(`💥 Bol.com: Search failed:`, error.message);
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
      console.log(`🔍 Bol.com: Extracting search results...`);
      
      // Try multiple selectors for product items - Updated for 2024
      const productSelectors = [
        '[data-testid="product-item"]',
        '.product-item',
        '.js_item_root',
        '[data-test="product-item"]',
        '.search-result-item',
        '.product',
        '.hit',
        '.js_item_container',
        '.list-item',
        '[data-test="product"]',
        '.product-small',
        '.search-result'
      ];
      
      let foundElements = 0;
      let usedSelector = '';
      
      for (const selector of productSelectors) {
        const elements = await this.page.$$(selector);
        console.log(`🔍 Bol.com: Product selector "${selector}" found ${elements.length} elements`);
        if (elements.length > 0) {
          foundElements = elements.length;
          usedSelector = selector;
          break;
        }
      }
      
      if (foundElements === 0) {
        console.log(`❌ Bol.com: No product elements found with any selector`);
        return [];
      }
      
      console.log(`📦 Bol.com: Using selector "${usedSelector}", processing ${foundElements} products...`);
      
      const products = await this.page!.evaluate((selector) => {
        const productElements = document.querySelectorAll(selector);
        console.log(`Found ${productElements.length} product elements in browser`);
        
        return Array.from(productElements).map((element, index) => {
          try {
            // Try multiple selectors for title
            const titleSelectors = [
              '[data-testid="product-title"]',
              '.product-title',
              'h3 a',
              '.product-name',
              'a[data-test="title"]'
            ];
            
            let title = '';
            for (const titleSelector of titleSelectors) {
              const titleElement = element.querySelector(titleSelector);
              if (titleElement?.textContent?.trim()) {
                title = titleElement.textContent.trim();
                break;
              }
            }
            
            // Try multiple selectors for price
            const priceSelectors = [
              '[data-testid="price"]',
              '.price',
              '.product-price',
              '[data-test="price"]',
              '.price-current'
            ];
            
            let priceText = '';
            for (const priceSelector of priceSelectors) {
              const priceElement = element.querySelector(priceSelector);
              if (priceElement?.textContent?.trim()) {
                priceText = priceElement.textContent.trim();
                break;
              }
            }
            
          const price = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
          
            // Try multiple selectors for URL
            const linkSelectors = [
              'a[href*="/p/"]',
              'a[href*="/product/"]',
              'h3 a',
              '.product-title a',
              'a[data-test="title"]'
            ];
            
            let url = '';
            for (const linkSelector of linkSelectors) {
              const linkElement = element.querySelector(linkSelector);
              if (linkElement?.getAttribute('href')) {
                url = linkElement.getAttribute('href') || '';
                break;
              }
            }
            
          const fullUrl = url.startsWith('http') ? url : `https://www.bol.com${url}`;
          
          // Extract availability
            const availabilityElement = element.querySelector('[data-testid="availability"], .availability, .stock-status');
          const availability = availabilityElement?.textContent?.toLowerCase().includes('op voorraad') || false;
          
            // Extract merchant
            const merchantElement = element.querySelector('[data-testid="seller"], .seller, .merchant');
          const merchant = merchantElement?.textContent?.trim() || 'Bol.com';
          
          return {
            title,
            price,
            url: fullUrl,
            availability,
            merchant,
              source: 'Bol.com',
              debugInfo: {
                elementIndex: index,
                titleFound: !!title,
                priceFound: !!price,
                urlFound: !!url
              }
            };
          } catch (error) {
            console.error(`Error processing product ${index}:`, error);
            return null;
          }
        }).filter(product => product !== null);
      }, usedSelector);
      
      console.log(`🎯 Bol.com: Successfully extracted ${products.length} products from ${foundElements} elements`);
      
      // Log details for first few products
      products.slice(0, 3).forEach((product, index) => {
        console.log(`   Product ${index + 1}: "${product.title}" - €${product.price} - ${product.url ? 'Has URL' : 'No URL'}`);
      });
      
      return products.filter(p => p.title && p.price > 0);
    } catch (error) {
      console.error(`💥 Bol.com: Error extracting search results:`, error.message);
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
