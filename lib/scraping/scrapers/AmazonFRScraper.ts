import { BaseScraper } from './BaseScraper';
import { ScrapingSource, ScrapedProductData } from '../types';

export class AmazonFRScraper extends BaseScraper {
  constructor(source: ScrapingSource) {
    super(source);
  }

  async searchProducts(searchTerm: string): Promise<ScrapedProductData[]> {
    try {
      const searchUrl = `https://www.amazon.fr/s?k=${encodeURIComponent(searchTerm)}`;
      console.log(`🔍 Amazon FR: Searching for "${searchTerm}"`);
      console.log(`🔗 Amazon FR: URL = ${searchUrl}`);
      
      await this.navigateToUrl(searchUrl);
      console.log(`✅ Amazon FR: Navigation completed`);
      
      // Wait for page to load (optimized)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check page title
      const pageTitle = await this.page.title();
      console.log(`📄 Amazon FR: Page title = "${pageTitle}"`);
      
      // Check current URL
      const currentUrl = this.page.url();
      console.log(`🔗 Amazon FR: Current URL = ${currentUrl}`);
      
      // Check for anti-bot protection
      if (await this.hasAntiBotProtection()) {
        console.warn('⚠️ Amazon FR: Anti-bot protection detected');
        return [];
      }
      console.log(`✅ Amazon FR: No anti-bot protection detected`);

      // Try to wait for search results (optimized timeout)
      try {
        await this.waitForSelector('[data-component-type="s-search-result"]', 5000);
        console.log(`✅ Amazon FR: Search results selector found`);
      } catch (selectorError) {
        console.log(`❌ Amazon FR: Main selector failed, trying alternatives...`);
        
        // Try alternative selectors
        const alternatives = ['.s-result-item', '[data-asin]', '[cel_widget_id*="MAIN-SEARCH_RESULTS"]'];
        let found = false;
        
        for (const altSelector of alternatives) {
          try {
            await this.waitForSelector(altSelector, 2000);
            console.log(`✅ Amazon FR: Alternative selector "${altSelector}" found`);
            found = true;
            break;
          } catch (e) {
            console.log(`❌ Amazon FR: Alternative selector "${altSelector}" failed`);
          }
        }
        
        if (!found) {
          throw new Error('No valid selectors found');
        }
      }

      const products: ScrapedProductData[] = [];
      
      // Try multiple selectors for product elements
      let productElements: any[] = [];
      const selectors = [
        '[data-component-type="s-search-result"]',
        '.s-result-item',
        '[data-asin]'
      ];
      
      for (const selector of selectors) {
        productElements = await this.page.$$(selector);
        console.log(`🔍 Amazon FR: Selector "${selector}" found ${productElements.length} elements`);
        if (productElements.length > 0) break;
      }

      if (productElements.length === 0) {
        console.log(`❌ Amazon FR: No product elements found with any selector`);
        return [];
      }

      console.log(`📦 Amazon FR: Processing ${Math.min(productElements.length, 10)} products...`);

      for (const [index, element] of productElements.slice(0, 10).entries()) {
        try {
          console.log(`   Processing product ${index + 1}...`);
          const product = await this.extractProductFromElement(element);
          if (product) {
            console.log(`   ✅ Extracted: ${product.title} - ${product.price}`);
            products.push(product);
          } else {
            console.log(`   ❌ Failed to extract product data`);
          }
        } catch (error) {
          console.log(`   ❌ Error extracting product ${index + 1}:`, error.message);
          continue;
        }
      }

      console.log(`🎯 Amazon FR: Successfully extracted ${products.length} products`);
      return products;

    } catch (error) {
      console.error('💥 Amazon FR: Search failed:', error.message);
      return [];
    }
  }

  async scrapeProduct(searchTerm: string): Promise<ScrapedProductData | null> {
    try {
      const searchResults = await this.searchProducts(searchTerm);
      
      if (searchResults.length === 0) {
        return null;
      }

      // Return the first (most relevant) result
      return searchResults[0];

    } catch (error) {
      console.error('Error scraping product from Amazon FR:', error);
      return null;
    }
  }

  private async extractProductFromElement(element: any): Promise<ScrapedProductData | null> {
    try {
      console.log(`      🔍 Extracting product data...`);
      
      // Extract product title - try multiple selectors
      const titleSelectors = [
        'h2 a span',
        '.a-size-medium span',
        '.a-size-mini span', 
        'h2 span',
        '.s-title-instructions-style span'
      ];
      
      let title = '';
      let usedTitleSelector = '';
      
      for (const selector of titleSelectors) {
        try {
          const titleElement = await element.$(selector);
          if (titleElement) {
            const titleText = await this.page.evaluate(el => el.textContent?.trim(), titleElement);
            if (titleText) {
              title = titleText;
              usedTitleSelector = selector;
              console.log(`      ✅ Title found: "${title}" (using ${selector})`);
              break;
            }
          }
        } catch (e) {
          console.log(`      ❌ Title selector "${selector}" failed`);
        }
      }

      if (!title) {
        console.log(`      ❌ No title found with any selector`);
        return null;
      }

      // Extract price - try multiple selectors
      const priceSelectors = [
        '.a-price .a-offscreen',
        '.a-price-whole',
        '.a-price .a-price-whole', 
        'span[data-a-color="price"] .a-offscreen',
        '.a-price-current .a-offscreen'
      ];
      
      let price: number | null = null;
      let priceText = '';
      let usedPriceSelector = '';
      
      for (const selector of priceSelectors) {
        try {
          const priceElement = await element.$(selector);
          if (priceElement) {
            const priceString = await this.page.evaluate(el => el.textContent?.trim(), priceElement);
            if (priceString) {
              priceText = priceString;
              price = this.parsePrice(priceString);
              usedPriceSelector = selector;
              console.log(`      💰 Price found: "${priceText}" -> ${price} (using ${selector})`);
              if (price) break;
            }
          }
        } catch (e) {
          console.log(`      ❌ Price selector "${selector}" failed`);
        }
      }

      if (!price) {
        console.log(`      ❌ No valid price found. Raw text: "${priceText}"`);
        return null;
      }

      // Extract URL - improved approach with more selectors
      const linkSelectors = [
        'h2 a',
        'h3 a', 
        '.a-link-normal',
        'a[href*="/dp/"]',
        'a[href*="/gp/product/"]',
        '.s-title-instructions-style a',
        '.a-size-medium a',
        '.a-size-mini a',
        'span[data-component-type="s-product-image"] a'
      ];
      
      let url = '';
      let usedLinkSelector = '';
      
      for (const linkSelector of linkSelectors) {
        try {
          const linkElement = await element.$(linkSelector);
          if (linkElement) {
            const href = await this.page.evaluate(el => {
              const hrefAttr = el.getAttribute('href');
              return hrefAttr || el.getAttribute('data-href');
            }, linkElement);
            
            console.log(`      🔍 Trying URL selector "${linkSelector}": ${href ? href.substring(0, 50) + '...' : 'null'}`);
            
            if (href && href.length > 5) {
              url = href;
              usedLinkSelector = linkSelector;
              console.log(`      ✅ URL selector "${linkSelector}" found: ${href.substring(0, 50)}...`);
              break;
            }
          } else {
            console.log(`      ❌ URL selector "${linkSelector}" - no element found`);
          }
        } catch (e) {
          console.log(`      ❌ URL selector "${linkSelector}" failed: ${e.message}`);
        }
      }
      
      // Clean and construct full URL
      let fullUrl = '';
      if (url) {
        if (url.startsWith('http')) {
          fullUrl = url;
        } else if (url.startsWith('/')) {
          fullUrl = `https://www.amazon.fr${url}`;
        } else {
          fullUrl = `https://www.amazon.fr/${url}`;
        }
        
        // Clean up URL parameters
        try {
          const urlObj = new URL(fullUrl);
          const essentialParams = ['dp', 'gp', 'product'];
          const newParams = new URLSearchParams();
          for (const [key, value] of urlObj.searchParams) {
            if (essentialParams.some(param => key.includes(param))) {
              newParams.set(key, value);
            }
          }
          urlObj.search = newParams.toString();
          fullUrl = urlObj.toString();
        } catch (e) {
          console.log(`      ⚠️ URL parsing failed, using original: ${url}`);
        }
      }
      
      console.log(`      🔗 Final URL: ${fullUrl}`);

      // Extract availability
      const availabilityElement = await element.$('.a-color-price');
      const availabilityText = availabilityElement ? await this.page.evaluate(el => el.textContent?.trim(), availabilityElement) : '';
      const availability = !availabilityText.toLowerCase().includes('rupture de stock');
      console.log(`      ✅ Availability: ${availability} (text: "${availabilityText}")`);

      // Extract merchant - improved approach to avoid numbers
      let merchant = 'Amazon FR';
      let merchantText = '';
      
      // Try to find actual merchant name, not numbers
      const merchantSelectors = [
        'span[aria-label*="par"]', // French "by" indicator
        '.a-size-base-plus:not([class*="price"])',
        '.a-color-base:not([class*="price"])',
        '.a-row .a-size-base:not([class*="price"])',
        '.s-size-mini .a-color-base',
        'span:contains("par")', // French for "by"
        '.a-color-secondary:not([class*="price"]):not([class*="shipping"])'
      ];
      
      for (const merchantSelector of merchantSelectors) {
        try {
          const merchantElements = await element.$$(merchantSelector);
          for (const merchantElement of merchantElements) {
            const text = await this.page.evaluate(el => el.textContent?.trim(), merchantElement);
            if (text && 
                text.length > 2 && 
                text.length < 100 && 
                !text.match(/^\d+$/) && // Not just numbers
                !text.match(/^€/) && // Not a price
                !text.match(/^\d+[,\.]?\d*\s*€/) && // Not a price with currency
                !text.includes('livraison') && // Not shipping info
                !text.includes('shipping') &&
                !text.includes('gratuit') &&
                !text.includes('expédition') &&
                text !== 'true' &&
                text !== 'false') {
              
              // Clean up common prefixes
              let cleanMerchant = text.replace(/^par\s+/i, '').trim();
              cleanMerchant = cleanMerchant.replace(/^by\s+/i, '').trim();
              
              if (cleanMerchant.length > 2) {
                merchantText = text;
                merchant = cleanMerchant;
                console.log(`      🏪 Merchant found with "${merchantSelector}": "${cleanMerchant}" (raw: "${text}")`);
                break;
              }
            }
          }
          if (merchant !== 'Amazon FR') break; // Found a valid merchant
        } catch (e) {
          console.log(`      ❌ Merchant selector "${merchantSelector}" failed: ${e.message}`);
        }
      }
      
      // Fallback: if we still have numbers or invalid data, use Amazon
      if (merchant.match(/^\d+$/) || merchant.length < 3) {
        merchant = 'Amazon FR';
        console.log(`      🏪 Merchant defaulted to: "${merchant}" (was: "${merchantText}")`);
      } else {
        console.log(`      🏪 Final merchant: "${merchant}"`);
      }

      // Extract shipping info
      const shippingElement = await element.$('.a-size-base.a-color-secondary');
      const shippingText = shippingElement ? await this.page.evaluate(el => el.textContent?.trim(), shippingElement) : '';
      const shippingCost = this.parseShippingCost(shippingText);
      console.log(`      🚚 Shipping: "${shippingText}" -> ${shippingCost}`);

      const result = {
        title: title.trim(),
        price: price.toString(),
        currency: 'EUR',
        url: fullUrl,
        merchant: merchant.trim(),
        availability,
        shippingCost: shippingCost ? shippingCost.toString() : undefined,
        source: 'amazon-fr',
        scrapedAt: new Date().toISOString()
      };
      
      console.log(`      🎯 Successfully extracted product data`);
      return result;

    } catch (error) {
      console.warn(`      💥 Error extracting product data:`, error.message);
      return null;
    }
  }

  private parsePrice(priceText: string): number | null {
    if (!priceText) return null;
    
    // Remove currency symbols and spaces, replace comma with dot
    const cleanPrice = priceText.replace(/[€\s]/g, '').replace(',', '.');
    const price = parseFloat(cleanPrice);
    
    return isNaN(price) ? null : price;
  }

  private parseShippingCost(shippingText: string): number | null {
    if (!shippingText) return null;
    
    // Look for shipping cost patterns like "Livraison: €2,99"
    const shippingMatch = shippingText.match(/€\s*(\d+[,\d]*)/);
    if (shippingMatch) {
      const cleanPrice = shippingMatch[1].replace(',', '.');
      const price = parseFloat(cleanPrice);
      return isNaN(price) ? null : price;
    }
    
    // Check for free shipping
    if (shippingText.toLowerCase().includes('livraison gratuite')) {
      return 0;
    }
    
    return null;
  }

  protected async hasAntiBotProtection(): Promise<boolean> {
    try {
      // Check for common anti-bot indicators on Amazon
      const captchaExists = await this.page.$('#captcha');
      const robotCheckExists = await this.page.$('#robot-check');
      const suspiciousActivityExists = await this.page.$('.a-box-inner:contains("suspicious")');
      
      return !!(captchaExists || robotCheckExists || suspiciousActivityExists);
    } catch (error) {
      return false;
    }
  }

  protected async waitForRateLimit(): Promise<void> {
    // Amazon FR is sensitive to rate limiting, wait longer
    await this.delay(2000 + Math.random() * 1000);
  }
}
