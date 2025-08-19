import { PrismaClient } from '@prisma/client';

export interface CurrencyRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: Date;
  source: string;
}

export class CurrencyConverter {
  private prisma: PrismaClient;
  private cache: Map<string, { rate: number; timestamp: number }> = new Map();
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Convert amount from one currency to another
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    date?: Date
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    try {
      const rate = await this.getExchangeRate(fromCurrency, toCurrency, date);
      return amount * rate;
    } catch (error) {
      console.error(`Error converting ${amount} ${fromCurrency} to ${toCurrency}:`, error);
      throw new Error(`Currency conversion failed: ${fromCurrency} to ${toCurrency}`);
    }
  }

  /**
   * Get exchange rate between two currencies
   */
  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    date?: Date
  ): Promise<number> {
    const cacheKey = `${fromCurrency}_${toCurrency}_${date ? date.toISOString().split('T')[0] : 'latest'}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.rate;
    }

    try {
      let rate: number;

      if (date) {
        // Get rate for specific date
        rate = await this.getHistoricalRate(fromCurrency, toCurrency, date);
      } else {
        // Get latest rate
        rate = await this.getLatestRate(fromCurrency, toCurrency);
      }

      // Cache the rate
      this.cache.set(cacheKey, { rate, timestamp: Date.now() });

      return rate;
    } catch (error) {
      console.error(`Error getting exchange rate for ${fromCurrency} to ${toCurrency}:`, error);
      throw error;
    }
  }

  /**
   * Get latest exchange rate from database
   */
  private async getLatestRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const rate = await this.prisma.currencyRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        isActive: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    if (!rate) {
      throw new Error(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
    }

    return parseFloat(rate.rate.toString());
  }

  /**
   * Get historical exchange rate for a specific date
   */
  private async getHistoricalRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<number> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const rate = await this.prisma.currencyRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        date: targetDate,
        isActive: true
      }
    });

    if (!rate) {
      // Fallback to latest rate if historical not found
      console.warn(`Historical rate not found for ${fromCurrency} to ${toCurrency} on ${date}, using latest`);
      return this.getLatestRate(fromCurrency, toCurrency);
    }

    return parseFloat(rate.rate.toString());
  }

  /**
   * Update exchange rates from external API
   */
  async updateExchangeRates(): Promise<void> {
    try {
      console.log('Updating exchange rates...');

      // Get supported currencies (focus on EU currencies)
      const supportedCurrencies = ['EUR', 'USD', 'GBP', 'CHF', 'NOK', 'SEK', 'DKK', 'PLN', 'CZK', 'HUF'];
      
      for (const fromCurrency of supportedCurrencies) {
        for (const toCurrency of supportedCurrencies) {
          if (fromCurrency === toCurrency) continue;

          try {
            const rate = await this.fetchRateFromAPI(fromCurrency, toCurrency);
            
            if (rate) {
              await this.saveRate(fromCurrency, toCurrency, rate);
              console.log(`Updated rate: ${fromCurrency} to ${toCurrency} = ${rate}`);
            }

            // Rate limiting to avoid API abuse
            await this.delay(100);
          } catch (error) {
            console.warn(`Failed to update rate for ${fromCurrency} to ${toCurrency}:`, error);
          }
        }
      }

      console.log('Exchange rate update completed');
    } catch (error) {
      console.error('Error updating exchange rates:', error);
      throw error;
    }
  }

  /**
   * Fetch rate from external API (placeholder implementation)
   */
  private async fetchRateFromAPI(fromCurrency: string, toCurrency: string): Promise<number | null> {
    try {
      // This would integrate with a real exchange rate API
      // For now, we'll use mock rates for demonstration
      
      // Mock rates (in real implementation, this would call an API)
      const mockRates: Record<string, Record<string, number>> = {
        'EUR': {
          'USD': 1.08,
          'GBP': 0.86,
          'CHF': 0.95,
          'NOK': 11.2,
          'SEK': 11.1,
          'DKK': 7.45,
          'PLN': 4.32,
          'CZK': 24.8,
          'HUF': 395.0
        },
        'USD': {
          'EUR': 0.93,
          'GBP': 0.80,
          'CHF': 0.88
        },
        'GBP': {
          'EUR': 1.16,
          'USD': 1.25,
          'CHF': 1.10
        }
      };

      // Get direct rate
      if (mockRates[fromCurrency]?.[toCurrency]) {
        return mockRates[fromCurrency][toCurrency];
      }

      // Get inverse rate
      if (mockRates[toCurrency]?.[fromCurrency]) {
        return 1 / mockRates[toCurrency][fromCurrency];
      }

      // Calculate cross-rate through EUR if possible
      if (fromCurrency !== 'EUR' && toCurrency !== 'EUR') {
        const fromToEur = mockRates[fromCurrency]?.['EUR'] || mockRates['EUR']?.[fromCurrency];
        const eurToTo = mockRates['EUR']?.[toCurrency] || mockRates[toCurrency]?.['EUR'];
        
        if (fromToEur && eurToTo) {
          const fromToEurRate = fromToEur > 1 ? fromToEur : 1 / fromToEur;
          const eurToToRate = eurToTo > 1 ? eurToTo : 1 / eurToTo;
          return fromToEurRate * eurToToRate;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error fetching rate from API for ${fromCurrency} to ${toCurrency}:`, error);
      return null;
    }
  }

  /**
   * Save exchange rate to database
   */
  private async saveRate(
    fromCurrency: string,
    toCurrency: string,
    rate: number
  ): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if rate already exists for today
      const existingRate = await this.prisma.currencyRate.findFirst({
        where: {
          fromCurrency,
          toCurrency,
          date: today
        }
      });

      if (existingRate) {
        // Update existing rate
        await this.prisma.currencyRate.update({
          where: { id: existingRate.id },
          data: {
            rate,
            updatedAt: new Date()
          }
        });
      } else {
        // Create new rate
        await this.prisma.currencyRate.create({
          data: {
            fromCurrency,
            toCurrency,
            rate,
            date: today,
            source: 'API',
            isActive: true
          }
        });
      }
    } catch (error) {
      console.error(`Error saving exchange rate for ${fromCurrency} to ${toCurrency}:`, error);
      throw error;
    }
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): string[] {
    return ['EUR', 'USD', 'GBP', 'CHF', 'NOK', 'SEK', 'DKK', 'PLN', 'CZK', 'HUF'];
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0.8 // Placeholder - would calculate actual hit rate
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
