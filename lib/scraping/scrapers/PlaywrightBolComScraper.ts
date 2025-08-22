import { PlaywrightBaseScraper } from './PlaywrightBaseScraper';
import { ScrapingSource, ScrapedProductData } from '../types';

export class PlaywrightBolComScraper extends PlaywrightBaseScraper {
  constructor(source: ScrapingSource) {
    super(source);
  }

  async searchProducts(searchTerm: string): Promise<ScrapedProductData[]> {
    try {
      const searchUrl = `https://www.bol.com/nl/s/?q=${encodeURIComponent(searchTerm)}`;
      console.log(`🔍 Playwright Bol.com: Searching for "${searchTerm}"`);
      console.log(`🔗 Playwright Bol.com: URL = ${searchUrl}`);
      
      await this.navigateToUrl(searchUrl);
      console.log(`✅ Playwright Bol.com: Navigation completed`);
      
      // Wait for page to load
      await this.delay(2000);
      
      // Check page title
      const pageTitle = await this.page.title();
      console.log(`📄 Playwright Bol.com: Page title = "${pageTitle}"`);
      
      // Check for anti-bot protection
      if (await this.hasAntiBotProtection()) {
        console.warn('⚠️ Playwright Bol.com: Anti-bot protection detected');
        return [];
      }
      console.log(`✅ Playwright Bol.com: No anti-bot protection detected`);

      // Try to wait for search results
      const found = await this.waitForSelector('[data-test="product-item"]', 5000);
      if (!found) {
        console.log(`❌ Playwright Bol.com: No product items found`);
        return [];
      }
      console.log(`✅ Playwright Bol.com: Product items found`);

      const products: ScrapedProductData[] = [];
      
      // Get product elements
      const productElements = await this.page.$$('[data-test="product-item"]');
      console.log(`📦 Playwright Bol.com: Found ${productElements.length} product elements`);

      // Process first 10 products
      const limit = Math.min(productElements.length, 10);
      for (let i = 0; i < limit; i++) {
        try {
          console.log(`   Processing product ${i + 1}/${limit}...`);
          const element = productElements[i];
          
          // Extract product data
          const titleElement = await element.$('[data-test="product-title"]');
          const title = titleElement ? await titleElement.textContent() : '';
          
          const priceElement = await element.$('[data-test="price"]');
          const priceText = priceElement ? await priceElement.textContent() : '';
          
          const linkElement = await element.$('a[href]');
          const href = linkElement ? await linkElement.getAttribute('href') : '';
          
          if (title && priceText) {
            // Parse price
            const priceMatch = priceText.match(/[\d,]+\.?\d*/);
            const price = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
            
            // Build full URL
            const fullUrl = href && href.startsWith('/') ? `https://www.bol.com${href}` : href || '';
            
            const product: ScrapedProductData = {
              title: title.trim(),
              price,
              currency: 'EUR',
              url: fullUrl,
              merchant: 'Bol.com',
              availability: 'available',
              scrapedAt: new Date()
            };
            
            console.log(`   ✅ Extracted: ${product.title} - €${product.price}`);
            products.push(product);
          } else {
            console.log(`   ❌ Failed to extract product data (missing title or price)`);
          }
        } catch (error) {
          console.log(`   ❌ Error extracting product ${i + 1}:`, error.message);
          continue;
        }
      }

      console.log(`✅ Playwright Bol.com: Extracted ${products.length} products for "${searchTerm}"`);
      return products;

    } catch (error) {
      console.error(`❌ Playwright Bol.com search failed for "${searchTerm}":`, error);
      return [];
    }
  }

  async scrapeProduct(searchTerm: string): Promise<ScrapedProductData | null> {
    const products = await this.searchProducts(searchTerm);
    return products.length > 0 ? products[0] : null;
  }
}
