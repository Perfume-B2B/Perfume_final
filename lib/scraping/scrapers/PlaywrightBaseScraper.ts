import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { ScrapingSource, ScrapingSourceConfig } from '../types';

// Import @sparticuz/chromium for serverless environments
let sparticuzChromium: any;
try {
  sparticuzChromium = require('@sparticuz/chromium');
  console.log('✅ @sparticuz/chromium loaded successfully for Playwright');
} catch (e) {
  console.warn('⚠️ @sparticuz/chromium not available for Playwright:', e.message);
}

// Fallback: try to use Playwright's built-in chromium if @sparticuz/chromium fails
let fallbackChromium: any;
try {
  fallbackChromium = require('playwright').chromium;
  console.log('✅ Playwright chromium fallback loaded');
} catch (e) {
  console.warn('⚠️ Playwright chromium fallback not available:', e.message);
}

export abstract class PlaywrightBaseScraper {
  protected source: ScrapingSource;
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected isInitialized = false;

  constructor(source: ScrapingSource) {
    this.source = source;
  }

  /**
   * Initialize the scraper using Playwright (much more reliable on Vercel)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log(`🎭 Starting Playwright initialization for ${this.source.name}...`);
    const startTime = Date.now();

    try {
      const isServerless = process.env.VERCEL || process.env.LAMBDA_TASK_ROOT || process.env.VERCEL_ENV;
      
      if (isServerless) {
        console.log('🔧 Serverless Playwright - using @sparticuz/chromium config');
        
        // Check if @sparticuz/chromium is available
        if (!sparticuzChromium) {
          console.warn('⚠️ @sparticuz/chromium not available, trying Playwright fallback...');
          
          if (!fallbackChromium) {
            throw new Error('❌ Neither @sparticuz/chromium nor Playwright chromium fallback is available');
          }
          
          // Use Playwright's built-in chromium as fallback
          console.log('🔄 Using Playwright built-in chromium as fallback');
          this.browser = await fallbackChromium.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--single-process',
              '--no-zygote',
              '--disable-background-timer-throttling',
              '--disable-renderer-backgrounding',
              '--disable-backgrounding-occluded-windows',
              '--memory-pressure-off',
              '--max_old_space_size=512'
            ],
            timeout: 15000
          });
          console.log(`✅ Playwright browser launched for ${this.source.name} using fallback chromium`);
        } else {
          console.log('🔍 @sparticuz/chromium is available, getting executable path...');
          
          // Get the executable path from @sparticuz/chromium
          let executablePath;
          try {
            console.log('📁 Getting @sparticuz/chromium executable path...');
            executablePath = await sparticuzChromium.executablePath({
              // Use a unique path to avoid conflicts
              cacheDir: `/tmp/chromium-playwright-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            });
            console.log('✅ Executable path obtained:', executablePath);
          } catch (pathError) {
            console.warn('⚠️ Failed to get custom cache dir, using default:', pathError.message);
            // Fallback to default path
            try {
              executablePath = await sparticuzChromium.executablePath();
              console.log('✅ Fallback executable path obtained:', executablePath);
            } catch (fallbackError) {
              console.error('❌ Failed to get any executable path:', fallbackError.message);
              throw new Error(`Failed to get @sparticuz/chromium executable path: ${fallbackError.message}`);
            }
          }
          
          console.log('✅ Using @sparticuz/chromium executable for Playwright:', executablePath);
          console.log('🔧 Preparing browser launch options...');
          
          // Debug @sparticuz/chromium args
          console.log('🔍 @sparticuz/chromium args count:', sparticuzChromium.args?.length);
          console.log('🔍 @sparticuz/chromium args preview:', sparticuzChromium.args?.slice(0, 5));
          
          // Prepare launch options
          const launchOptions = {
            executablePath,
            headless: true,
            args: [
              // Use @sparticuz/chromium args as base
              ...sparticuzChromium.args,
              // Add our safe args
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--single-process',
              '--no-zygote',
              '--disable-background-timer-throttling',
              '--disable-renderer-backgrounding',
              '--disable-backgrounding-occluded-windows',
              '--memory-pressure-off',
              '--max_old_space_size=512'
            ],
            timeout: 15000 // Fast timeout for serverless
          };
          
          console.log('🔧 Launch options prepared, args count:', launchOptions.args?.length);
          console.log('🚀 Launching browser with Playwright...');
          
          // Use Playwright with @sparticuz/chromium executable
          try {
            // Add timeout wrapper to prevent hanging
            const launchPromise = chromium.launch(launchOptions);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Browser launch exceeded 20 seconds')), 20000)
            );
            
            this.browser = await Promise.race([launchPromise, timeoutPromise]) as any;
            console.log(`✅ Playwright browser launched for ${this.source.name} using @sparticuz/chromium`);
          } catch (launchError) {
            console.error('❌ Browser launch failed:', launchError.message);
            console.error('❌ Launch error details:', launchError);
            throw launchError;
          }
        }
        
      } else {
        // Local environment
        this.browser = await chromium.launch({
          headless: this.source.config.useHeadless !== false,
          timeout: 30000
        });
        console.log(`✅ Playwright browser launched for ${this.source.name} (local)`);
      }

      // Create browser context with realistic settings
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: this.getRandomUserAgent(),
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });
      console.log(`📄 Browser context created for ${this.source.name}`);

      this.page = await this.context.newPage();
      console.log(`🎭 New page created for ${this.source.name}`);

      this.isInitialized = true;
      
      const elapsed = Date.now() - startTime;
      console.log(`✅ Playwright initialization completed for ${this.source.name} in ${elapsed}ms`);
      
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ Failed to initialize Playwright scraper for ${this.source.name} after ${elapsed}ms:`, error);
      
      // Cleanup on failure
      await this.cleanup();
      
      throw new Error(`Playwright scraper initialization failed for ${this.source.name}: ${error.message}`);
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
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.isInitialized = false;
    } catch (error) {
      console.error(`Error during Playwright cleanup for ${this.source.name}:`, error);
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
          waitUntil: 'networkidle',
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

      const text = await element.textContent();
      return text?.trim() || '';
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
      const elements = await this.page.$$(selector);
      const texts = await Promise.all(
        elements.map(async (el) => {
          const text = await el.textContent();
          return text?.trim() || '';
        })
      );
      
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

      const value = await element.getAttribute(attribute);
      return value || '';
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
      await this.page.fill(selector, text);
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
      return screenshot;
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
