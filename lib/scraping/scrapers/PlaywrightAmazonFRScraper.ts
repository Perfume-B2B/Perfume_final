import { PlaywrightBaseScraper } from './PlaywrightBaseScraper';
import { ScrapingSource, ScrapedProductData } from '../types';

export class PlaywrightAmazonFRScraper extends PlaywrightBaseScraper {
  constructor(source: ScrapingSource) {
    super(source);
  }

  async searchProducts(searchTerm: string): Promise<ScrapedProductData[]> {
    try {
      const searchUrl = `https://www.amazon.fr/s?k=${encodeURIComponent(searchTerm)}`;
      console.log(`🔍 Playwright Amazon FR: Searching for "${searchTerm}"`);
      
      await this.navigateToUrl(searchUrl);
      console.log(`✅ Playwright Amazon FR: Navigation completed`);
      
      await this.delay(1000);
      
      if (await this.hasAntiBotProtection()) {
        console.warn('⚠️ Playwright Amazon FR: Anti-bot protection detected');
        return [];
      }

      const selectors = [
        '[data-component-type="s-search-result"]',
        '.s-result-item',
        '[data-asin]'
      ];
      
      let productElements = [];
      for (const selector of selectors) {
        const found = await this.waitForSelector(selector, 3000);
        if (found) {
          productElements = await this.page.$$(selector);
          console.log(`✅ Amazon FR: Found ${productElements.length} products`);
          break;
        }
      }

      if (productElements.length === 0) {
        console.log(`❌ Amazon FR: No products found`);
        return [];
      }

      const products: ScrapedProductData[] = [];
      const limit = Math.min(productElements.length, 8);

      for (let i = 0; i < limit; i++) {
        try {
          const element = productElements[i];
          
          // Extract title
          const titleSelectors = ['h2 a span', '[data-cy="title-recipe-card"]', '.a-size-base-plus'];
          let title = '';
          for (const selector of titleSelectors) {
            const titleEl = await element.$(selector);
            if (titleEl) {
              title = await titleEl.textContent() || '';
              if (title.trim()) break;
            }
          }

          // Extract price
          const priceSelectors = ['.a-price-whole', '.a-price .a-offscreen'];
          let priceText = '';
          for (const selector of priceSelectors) {
            const priceEl = await element.$(selector);
            if (priceEl) {
              priceText = await priceEl.textContent() || '';
              if (priceText.trim()) break;
            }
          }

          // Extract URL
          let url = '';
          const linkEl = await element.$('h2 a, .a-link-normal');
          if (linkEl) {
            const href = await linkEl.getAttribute('href');
            if (href) {
              url = href.startsWith('http') ? href : `https://www.amazon.fr${href}`;
            }
          }

          if (title && priceText) {
            const priceMatch = priceText.match(/[\d,]+/);
            const price = priceMatch ? parseFloat(priceMatch[0].replace(',', '.')) : 0;

            const product: ScrapedProductData = {
              title: title.trim(),
              price,
              currency: 'EUR',
              url: url,
              merchant: 'Amazon FR',
              availability: 'available',
              scrapedAt: new Date()
            };

            products.push(product);
          }
        } catch (error) {
          continue;
        }
      }

      console.log(`✅ Playwright Amazon FR: Extracted ${products.length} products`);
      return products;

    } catch (error) {
      console.error(`❌ Amazon FR search failed:`, error);
      return [];
    }
  }

  async scrapeProduct(searchTerm: string): Promise<ScrapedProductData | null> {
    const products = await this.searchProducts(searchTerm);
    return products.length > 0 ? products[0] : null;
  }
}
