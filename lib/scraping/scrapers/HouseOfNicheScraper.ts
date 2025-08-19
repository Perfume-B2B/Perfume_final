import { BaseScraper } from './BaseScraper';
import { ScrapingSource, ScrapedProductData } from '../types';

export class HouseOfNicheScraper extends BaseScraper {
  constructor(source: ScrapingSource) {
    super(source);
  }

  async searchProducts(searchTerm: string): Promise<ScrapedProductData[]> {
    try {
      const searchUrl = `https://www.houseofniche.com/search?q=${encodeURIComponent(searchTerm)}`;
      
      await this.navigateToUrl(searchUrl);
      await this.waitForSelector('.product-item, .product-card, .search-result-item', 10000);

      // Check for anti-bot protection
      if (await this.hasAntiBotProtection()) {
        console.warn('Anti-bot protection detected on House of Niche');
        return [];
      }

      const products: ScrapedProductData[] = [];
      const productElements = await this.page.$$('.product-item, .product-card, .search-result-item');

      for (const element of productElements.slice(0, 10)) { // Limit to first 10 results
        try {
          const product = await this.extractProductFromElement(element);
          if (product) {
            products.push(product);
          }
        } catch (error) {
          console.warn('Error extracting product from House of Niche:', error);
          continue;
        }
      }

      return products;

    } catch (error) {
      console.error('Error searching House of Niche:', error);
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
      console.error('Error scraping product from House of Niche:', error);
      return null;
    }
  }

  private async extractProductFromElement(element: any): Promise<ScrapedProductData | null> {
    try {
      // Extract product title
      const titleElement = await element.$('h3, h4, .product-title, .product-name');
      const title = titleElement ? await this.extractText(titleElement) : '';

      if (!title) return null;

      // Extract price
      const priceElement = await element.$('.price, .product-price, .current-price');
      const priceText = priceElement ? await this.extractText(priceElement) : '';
      const price = this.parsePrice(priceText);

      if (!price) return null;

      // Extract URL
      const linkElement = await element.$('a');
      const url = linkElement ? await this.extractAttribute(linkElement, 'href') : '';
      const fullUrl = url ? (url.startsWith('http') ? url : `https://www.houseofniche.com${url}`) : '';

      // Extract availability
      const availabilityElement = await element.$('.availability, .stock-status, .in-stock');
      const availabilityText = availabilityElement ? await this.extractText(availabilityElement) : '';
      const availability = !availabilityText.toLowerCase().includes('out of stock') && 
                          !availabilityText.toLowerCase().includes('niet op voorraad');

      // Extract merchant (usually House of Niche itself)
      const merchant = 'House of Niche';

      // Extract shipping info (usually free shipping over certain amount)
      const shippingElement = await element.$('.shipping-info, .delivery-info');
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
        source: 'house-of-niche',
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.warn('Error extracting product data from House of Niche element:', error);
      return null;
    }
  }

  private parsePrice(priceText: string): number | null {
    if (!priceText) return null;
    
    // Remove currency symbols, spaces, and common text
    const cleanPrice = priceText
      .replace(/[€\s]/g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');
    
    const price = parseFloat(cleanPrice);
    
    return isNaN(price) ? null : price;
  }

  private parseShippingCost(shippingText: string): number | null {
    if (!shippingText) return null;
    
    // Check for free shipping indicators
    if (shippingText.toLowerCase().includes('free') || 
        shippingText.toLowerCase().includes('gratis') ||
        shippingText.toLowerCase().includes('free shipping')) {
      return 0;
    }
    
    // Look for specific shipping costs
    const shippingMatch = shippingText.match(/€\s*(\d+[,\d]*)/);
    if (shippingMatch) {
      const cleanPrice = shippingMatch[1].replace(',', '.');
      const price = parseFloat(cleanPrice);
      return isNaN(price) ? null : price;
    }
    
    return null;
  }

  protected async hasAntiBotProtection(): Promise<boolean> {
    try {
      // Check for common anti-bot indicators
      const captchaExists = await this.page.$('#captcha, .captcha, .recaptcha');
      const robotCheckExists = await this.page.$('#robot-check, .bot-check');
      const suspiciousActivityExists = await this.page.$('.error:contains("suspicious"), .blocked:contains("blocked")');
      
      return !!(captchaExists || robotCheckExists || suspiciousActivityExists);
    } catch (error) {
      return false;
    }
  }

  protected async waitForRateLimit(): Promise<void> {
    // House of Niche is a smaller site, moderate rate limiting
    await this.delay(1500 + Math.random() * 500);
  }
}
