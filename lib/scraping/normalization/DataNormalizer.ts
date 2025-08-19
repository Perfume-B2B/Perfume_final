import { Decimal } from "@prisma/client/runtime/library";
import { 
  ColumnMapping, 
  DataCleaningRules, 
  NormalizedProductData, 
  ValidationError, 
  ValidationWarning 
} from "../types";

export class DataNormalizer {
  private cleaningRules: DataCleaningRules;

  constructor(cleaningRules: DataCleaningRules = {}) {
    this.cleaningRules = {
      trimWhitespace: true,
      normalizeCase: 'titlecase',
      normalizeSizes: true,
      parseMultipacks: true,
      removeSpecialChars: false,
      ...cleaningRules
    };
  }

  /**
   * Normalize a single row of supplier data
   */
  normalizeRow(
    rawData: Record<string, string>, 
    columnMapping: ColumnMapping,
    rowNumber: number
  ): { 
    normalized: NormalizedProductData | null; 
    errors: ValidationError[]; 
    warnings: ValidationWarning[] 
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    try {
      // Extract and clean data based on mapping
      const brand = this.cleanString(rawData[columnMapping.brand], 'brand');
      const productName = this.cleanString(rawData[columnMapping.productName], 'productName');
      const variantSize = columnMapping.variantSize ? 
        this.normalizeSize(rawData[columnMapping.variantSize]) : undefined;
      const ean = columnMapping.ean ? 
        this.cleanEAN(rawData[columnMapping.ean]) : undefined;
      const wholesalePrice = this.parsePrice(rawData[columnMapping.wholesalePrice], 'wholesalePrice');
      const currency = columnMapping.currency ? 
        this.normalizeCurrency(rawData[columnMapping.currency]) : 'EUR';
      const packSize = columnMapping.packSize ? 
        this.parsePackSize(rawData[columnMapping.packSize]) : 1;
      const supplier = columnMapping.supplier ? 
        this.cleanString(rawData[columnMapping.supplier], 'supplier') : '';
      const lastPurchasePrice = columnMapping.lastPurchasePrice ? 
        this.parsePrice(rawData[columnMapping.lastPurchasePrice], 'lastPurchasePrice') : undefined;
      const availability = columnMapping.availability ? 
        this.parseAvailability(rawData[columnMapping.availability]) : true;
      const notes = columnMapping.notes ? 
        this.cleanString(rawData[columnMapping.notes], 'notes') : undefined;

      // Validation
      if (!brand) {
        errors.push({
          row: rowNumber,
          field: 'brand',
          message: 'Brand is required',
          data: rawData
        });
      }

      if (!productName) {
        errors.push({
          row: rowNumber,
          field: 'productName',
          message: 'Product name is required',
          data: rawData
        });
      }

      if (!wholesalePrice) {
        errors.push({
          row: rowNumber,
          field: 'wholesalePrice',
          message: 'Wholesale price is required and must be a valid number',
          data: rawData
        });
      }

      // EAN validation if provided
      if (ean && !this.isValidEAN(ean)) {
        warnings.push({
          row: rowNumber,
          field: 'ean',
          message: 'EAN format appears invalid (should be 13 digits)',
        });
      }

      // If critical errors exist, return null
      if (errors.some(e => ['brand', 'productName', 'wholesalePrice'].includes(e.field))) {
        return { normalized: null, errors, warnings };
      }

      const normalized: NormalizedProductData = {
        supplierId: '', // Will be set by caller
        brand: brand!,
        productName: productName!,
        variantSize,
        ean,
        wholesalePrice: wholesalePrice!,
        currency,
        packSize,
        supplierName: supplier,
        lastPurchasePrice,
        availability,
        notes
      };

      return { normalized, errors, warnings };

    } catch (error) {
      errors.push({
        row: rowNumber,
        field: 'general',
        message: `Unexpected error during normalization: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: rawData
      });
      return { normalized: null, errors, warnings };
    }
  }

  /**
   * Clean and standardize string values
   */
  private cleanString(value: string, field: string): string {
    if (!value) return '';

    let cleaned = value;

    if (this.cleaningRules.trimWhitespace) {
      cleaned = cleaned.trim();
    }

    if (this.cleaningRules.removeSpecialChars) {
      cleaned = cleaned.replace(/[^\w\s\-\.]/g, '');
    }

    if (this.cleaningRules.normalizeCase) {
      switch (this.cleaningRules.normalizeCase) {
        case 'lowercase':
          cleaned = cleaned.toLowerCase();
          break;
        case 'uppercase':
          cleaned = cleaned.toUpperCase();
          break;
        case 'titlecase':
          cleaned = this.toTitleCase(cleaned);
          break;
      }
    }

    return cleaned;
  }

  /**
   * Normalize size values (e.g., "100 ml" -> "100ml")
   */
  private normalizeSize(value: string): string | undefined {
    if (!value) return undefined;

    // Remove spaces and normalize common size formats
    let normalized = value.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/ml|milliliter|milliliters?/gi, 'ml')
      .replace(/l|liter|liters?/gi, 'L')
      .replace(/g|gram|grams?/gi, 'g')
      .replace(/kg|kilogram|kilograms?/gi, 'kg');

    // Extract numeric value
    const match = normalized.match(/(\d+(?:\.\d+)?)(ml|l|g|kg)/i);
    if (match) {
      const [, number, unit] = match;
      return `${number}${unit.toLowerCase()}`;
    }

    return normalized;
  }

  /**
   * Parse and validate EAN
   */
  private cleanEAN(value: string): string | undefined {
    if (!value) return undefined;

    // Remove non-digits
    const cleaned = value.replace(/\D/g, '');
    
    // Check if it's a valid length (8, 12, 13, or 14 digits)
    if ([8, 12, 13, 14].includes(cleaned.length)) {
      return cleaned;
    }

    return undefined;
  }

  /**
   * Validate EAN format
   */
  private isValidEAN(ean: string): boolean {
    if (!ean || ean.length < 8) return false;
    
    // Basic format validation
    return /^\d{8,14}$/.test(ean);
  }

  /**
   * Parse price values
   */
  private parsePrice(value: string, field: string): Decimal | undefined {
    if (!value) return undefined;

    try {
      // Remove currency symbols and non-numeric characters except decimal point
      const cleaned = value.replace(/[^\d.,]/g, '');
      
      // Handle different decimal separators
      let normalized = cleaned;
      if (cleaned.includes(',')) {
        // European format: 1.234,56 -> 1234.56
        normalized = cleaned.replace(/\./g, '').replace(',', '.');
      }

      const price = parseFloat(normalized);
      if (isNaN(price) || price < 0) {
        return undefined;
      }

      return new Decimal(price.toFixed(2));
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Normalize currency codes
   */
  private normalizeCurrency(value: string): string {
    if (!value) return 'EUR';

    const normalized = value.toUpperCase().trim();
    
    // Common currency mappings
    const currencyMap: Record<string, string> = {
      'EURO': 'EUR',
      'EUROS': 'EUR',
      'DOLLAR': 'USD',
      'DOLLARS': 'USD',
      'POUND': 'GBP',
      'POUNDS': 'GBP',
      '€': 'EUR',
      '$': 'USD',
      '£': 'GBP'
    };

    return currencyMap[normalized] || normalized;
  }

  /**
   * Parse pack size information
   */
  private parsePackSize(value: string): number {
    if (!value) return 1;

    try {
      // Extract numeric value from pack size
      const match = value.match(/(\d+)/);
      if (match) {
        const size = parseInt(match[1], 10);
        return size > 0 ? size : 1;
      }

      // Check for common pack size indicators
      const packIndicators = {
        'single': 1,
        'pack': 1,
        'set': 1,
        'bundle': 1,
        'twin': 2,
        'duo': 2,
        'triple': 3,
        'quad': 4
      };

      const lowerValue = value.toLowerCase();
      for (const [indicator, size] of Object.entries(packIndicators)) {
        if (lowerValue.includes(indicator)) {
          return size;
        }
      }

      return 1;
    } catch (error) {
      return 1;
    }
  }

  /**
   * Parse availability information
   */
  private parseAvailability(value: string): boolean {
    if (!value) return true;

    const lowerValue = value.toLowerCase();
    
    const availableIndicators = ['available', 'in stock', 'yes', 'true', '1', 'active'];
    const unavailableIndicators = ['unavailable', 'out of stock', 'no', 'false', '0', 'inactive'];

    if (availableIndicators.some(indicator => lowerValue.includes(indicator))) {
      return true;
    }

    if (unavailableIndicators.some(indicator => lowerValue.includes(indicator))) {
      return false;
    }

    // Default to available if unclear
    return true;
  }

  /**
   * Convert string to title case
   */
  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  /**
   * Get cleaning rules
   */
  getCleaningRules(): DataCleaningRules {
    return { ...this.cleaningRules };
  }

  /**
   * Update cleaning rules
   */
  updateCleaningRules(rules: Partial<DataCleaningRules>): void {
    this.cleaningRules = { ...this.cleaningRules, ...rules };
  }
}
