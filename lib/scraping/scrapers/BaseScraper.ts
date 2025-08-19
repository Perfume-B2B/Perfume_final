import puppeteer, { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';
import { ScrapingSource, ScrapingSourceConfig } from '../types';

export abstract class BaseScraper {
  protected source: ScrapingSource;
  protected browser: Browser | null = null;
  protected page: Page | null = null;
  protected isInitialized = false;

  constructor(source: ScrapingSource) {
    this.source = source;
  }

  /**
   * Initialize the scraper (launch browser, create page)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const proxyUrl = (this.source.config as any)?.proxyUrl || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      const launchArgs = [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ] as string[];
      if (proxyUrl) {
        launchArgs.push(`--proxy-server=${proxyUrl}`);
      }

      const launchOptions: PuppeteerLaunchOptions = {
        headless: this.source.config.useHeadless !== false,
        args: launchArgs,
        defaultViewport: { width: 1920, height: 1080 }
      };

      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();

      // Set user agent
      await this.page.setUserAgent(this.getRandomUserAgent());

      // Set extra headers
      if (this.source.config.headers) {
        await this.page.setExtraHTTPHeaders(this.source.config.headers);
      }

      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });

      this.isInitialized = true;
    } catch (error) {
      console.error(`Failed to initialize scraper for ${this.source.name}:`, error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.isInitialized = false;
    } catch (error) {
      console.error(`Error during cleanup for ${this.source.name}:`, error);
    }
  }

  /**
   * Navigate to a URL with retry logic
   */
  async navigateToUrl(url: string, maxRetries: number = 3): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.page.goto(url, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        return true;
      } catch (error) {
        console.warn(`Navigation attempt ${attempt} failed for ${url}:`, error);
        
        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retry
        await this.delay(1000 * attempt);
      }
    }

    return false;
  }

  /**
   * Wait for a selector to appear
   */
  async waitForSelector(selector: string, timeout: number = 10000): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract text content from an element
   */
  async extractText(selector: string): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      const element = await this.page.$(selector);
      if (!element) return '';

      const text = await this.page.evaluate(el => el.textContent?.trim() || '', element);
      return text;
    } catch (error) {
      console.warn(`Failed to extract text from ${selector}:`, error);
      return '';
    }
  }

  /**
   * Extract multiple text values from elements
   */
  async extractTextMultiple(selector: string): Promise<string[]> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      const texts = await this.page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).map(el => el.textContent?.trim() || '');
      }, selector);
      
      return texts.filter(text => text.length > 0);
    } catch (error) {
      console.warn(`Failed to extract multiple texts from ${selector}:`, error);
      return [];
    }
  }

  /**
   * Extract attribute value from an element
   */
  async extractAttribute(selector: string, attribute: string): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      const element = await this.page.$(selector);
      if (!element) return '';

      const value = await this.page.evaluate(
        (el, attr) => el.getAttribute(attr) || '', 
        element, 
        attribute
      );
      return value;
    } catch (error) {
      console.warn(`Failed to extract attribute ${attribute} from ${selector}:`, error);
      return '';
    }
    }

  /**
   * Extract href from a link element
   */
  async extractHref(selector: string): Promise<string> {
    return this.extractAttribute(selector, 'href');
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      const element = await this.page.$(selector);
      return element !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Click on an element
   */
  async clickElement(selector: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      await this.page.click(selector);
      return true;
    } catch (error) {
      console.warn(`Failed to click element ${selector}:`, error);
      return false;
    }
  }

  /**
   * Type text into an input field
   */
  async typeText(selector: string, text: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      await this.page.type(selector, text);
      return true;
    } catch (error) {
      console.warn(`Failed to type text into ${selector}:`, error);
      return false;
    }
  }

  /**
   * Wait for a delay
   */
  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Take a screenshot (useful for debugging)
   */
  async takeScreenshot(path?: string): Promise<Buffer | null> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      const screenshot = await this.page.screenshot({ 
        fullPage: true,
        path 
      });
      return screenshot as Buffer;
    } catch (error) {
      console.warn('Failed to take screenshot:', error);
      return null;
    }
  }

  /**
   * Get page content
   */
  async getPageContent(): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      return await this.page.content();
    } catch (error) {
      console.warn('Failed to get page content:', error);
      return '';
    }
  }

  /**
   * Execute custom JavaScript on the page
   */
  async executeScript<T>(script: string, ...args: any[]): Promise<T> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      return await this.page.evaluate(script, ...args);
    } catch (error) {
      console.warn('Failed to execute script:', error);
      throw error;
    }
  }

  /**
   * Get random user agent to avoid detection
   */
  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Check if the page has anti-bot protection
   */
  async hasAntiBotProtection(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      const indicators = [
        'captcha',
        'robot',
        'bot',
        'verification',
        'security check',
        'cloudflare',
        'access denied'
      ];

      const content = await this.getPageContent().toLowerCase();
      return indicators.some(indicator => content.includes(indicator));
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for rate limiting
   */
  async waitForRateLimit(): Promise<void> {
    const delay = this.source.config.delay || 1000;
    await this.delay(delay);
  }

  /**
   * Get source configuration
   */
  getSourceConfig(): ScrapingSourceConfig {
    return { ...this.source.config };
  }

  /**
   * Get source name
   */
  getSourceName(): string {
    return this.source.name;
  }

  /**
   * Check if scraper is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.page) return false;
      
      // Try to navigate to a simple page to test connectivity
      await this.page.goto('data:text/html,<html><body>Test</body></html>');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Abstract method that must be implemented by subclasses
   * This is the main scraping logic for each source
   */
  abstract scrapeProduct(searchTerm: string): Promise<any>;

  /**
   * Abstract method for searching products
   */
  abstract searchProducts(query: string): Promise<any[]>;
}
