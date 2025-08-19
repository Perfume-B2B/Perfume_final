import { BaseScraper } from './BaseScraper';
import { ScrapingSource, ScrapedProductData } from '../types';

export class AmazonNLScraper extends BaseScraper {
  constructor(source: ScrapingSource) {
    super(source);
  }

  async searchProducts(searchTerm: string): Promise<ScrapedProductData[]> {
    try {
      const searchUrl = `https://www.amazon.nl/s?k=${encodeURIComponent(searchTerm)}`;
      
      await this.navigateToUrl(searchUrl);
      await this.waitForSelector('[data-component-type="s-search-result"]', 10000);

      // Check for anti-bot protection
      if (await this.hasAntiBotProtection()) {
        console.warn('Anti-bot protection detected on Amazon NL');
        return [];
      }

      const products: ScrapedProductData[] = [];
      const productElements = await this.page.$$('[data-component-type="s-search-result"]');

      for (const element of productElements.slice(0, 10)) { // Limit to first 10 results
        try {
          const product = await this.extractProductFromElement(element);
          if (product) {
            products.push(product);
          }
        } catch (error) {
          console.warn('Error extracting product from Amazon NL:', error);
          continue;
        }
      }

      return products;

    } catch (error) {
      console.error('Error searching Amazon NL:', error);
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
      console.error('Error scraping product from Amazon NL:', error);
      return null;
    }
  }

  private async extractProductFromElement(element: any): Promise<ScrapedProductData | null> {
    try {
      // Extract product title
      const titleElement = await element.$('h2 a span');
      const title = titleElement ? await this.extractText(titleElement) : '';

      if (!title) return null;

      // Extract price
      const priceElement = await element.$('.a-price .a-offscreen');
      const priceText = priceElement ? await this.extractText(priceElement) : '';
      const price = this.parsePrice(priceText);

      if (!price) return null;

      // Extract URL
      const linkElement = await element.$('h2 a');
      const url = linkElement ? await this.extractAttribute(linkElement, 'href') : '';
      const fullUrl = url ? `https://www.amazon.nl${url}` : '';

      // Extract availability
      const availabilityElement = await element.$('.a-color-price');
      const availabilityText = availabilityElement ? await this.extractText(availabilityElement) : '';
      const availability = !availabilityText.toLowerCase().includes('niet op voorraad');

      // Extract merchant (Amazon or third-party)
      const merchantElement = await element.$('.a-row .a-size-base');
      const merchant = merchantElement ? await this.extractText(merchantElement) : 'Amazon';

      // Extract shipping info
      const shippingElement = await element.$('.a-size-base.a-color-secondary');
      const shippingText = shippingElement ? await this.extractText(shippingElement) : '';
      const shippingCost = this.parseShippingCost(shippingText);

      return {
        title: title.trim(),
        price: price.toString(),
        currency: 'EUR',
        url: fullUrl,
        merchant: merchant.trim(),
        availability,
        shippingCost: shippingCost ? shippingCost.toString() : undefined,
        source: 'amazon-nl',
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.warn('Error extracting product data from Amazon NL element:', error);
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
    
    // Look for shipping cost patterns like "Verzendkosten: €2,99"
    const shippingMatch = shippingText.match(/€\s*(\d+[,\d]*)/);
    if (shippingMatch) {
      const cleanPrice = shippingMatch[1].replace(',', '.');
      const price = parseFloat(cleanPrice);
      return isNaN(price) ? null : price;
    }
    
    // Check for free shipping
    if (shippingText.toLowerCase().includes('gratis verzending')) {
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
    // Amazon NL is sensitive to rate limiting, wait longer
    await this.delay(2000 + Math.random() * 1000);
  }
}
