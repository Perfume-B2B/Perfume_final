import { Decimal } from "@prisma/client/runtime/library";

// ============================================================================
// CORE TYPES FOR SCRAPING MODULE
// ============================================================================

// Supplier and mapping types
export interface SupplierData {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  currency?: string;
  isActive?: boolean;
  notes?: string;
}

export interface ColumnMapping {
  brand: string;
  productName: string;
  variantSize?: string;
  ean?: string;
  wholesalePrice: string;
  currency?: string;
  packSize?: string;
  supplier?: string;
  lastPurchasePrice?: string;
  availability?: string;
  notes?: string;
}

export interface SupplierMappingTemplate {
  id?: string;
  supplierId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  columnMappings: ColumnMapping;
  dataCleaningRules?: DataCleaningRules;
}

export interface DataCleaningRules {
  trimWhitespace?: boolean;
  normalizeCase?: 'lowercase' | 'uppercase' | 'titlecase' | 'none';
  normalizeSizes?: boolean;
  parseMultipacks?: boolean;
  removeSpecialChars?: boolean;
}

// Normalized product types
export interface NormalizedProductData {
  id?: string;
  supplierId: string;
  brand: string;
  productName: string;
  variantSize?: string;
  ean?: string;
  wholesalePrice: Decimal;
  currency: string;
  packSize: number;
  supplierName: string;
  lastPurchasePrice?: Decimal;
  availability: boolean;
  notes?: string;
  importSessionId?: string;
}

// Scraping source types
export interface ScrapingSource {
  id?: string;
  name: string;
  baseUrl: string;
  country: string;
  isActive: boolean;
  priority: number;
  rateLimit: number;
  config: ScrapingSourceConfig;
}

export interface ScrapingSourceConfig {
  selectors: {
    productTitle: string;
    price: string;
    availability: string;
    shipping?: string;
  };
  headers?: Record<string, string>;
  delay?: number;
  useHeadless?: boolean;
  customScripts?: string[];
}

// Price scraping result types
export interface PriceScrapingResult {
  id?: string;
  normalizedProductId: string;
  sourceId: string;
  productTitle: string;
  merchant: string;
  url: string;
  price: Decimal;
  currency: string;
  priceInclVat: boolean;
  shippingCost?: Decimal;
  availability: boolean;
  confidenceScore: Decimal;
  isLowestPrice: boolean;
  scrapedAt: Date;
  jobId?: string;
}

// Product matching types
export interface ProductMatch {
  normalizedProduct: NormalizedProductData;
  scrapedResults: PriceScrapingResult[];
  bestMatch?: PriceScrapingResult;
  confidenceScore: number;
  marginOpportunity?: number;
}

export interface MatchingConfig {
  eanWeight: number;
  brandSizeWeight: number;
  fuzzyTitleWeight: number;
  penaltyRules: PenaltyRule[];
}

export interface PenaltyRule {
  pattern: string;
  penalty: number;
  description: string;
}

// Job and processing types
export interface ScrapingJob {
  id?: string;
  name: string;
  description?: string;
  status: ScrapingJobStatus;
  supplierId?: string;
  totalProducts: number;
  processedProducts: number;
  successfulProducts: number;
  failedProducts: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  config: ScrapingJobConfig;
}

export interface ScrapingJobConfig {
  sources: string[];
  batchSize: number;
  delayBetweenBatches: number;
  maxRetries: number;
  timeout: number;
}

export type ScrapingJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

// Currency and pricing types
export interface CurrencyRate {
  id?: string;
  fromCurrency: string;
  toCurrency: string;
  rate: Decimal;
  date: Date;
  source: string;
  isActive: boolean;
}

export interface PriceAnalysis {
  normalizedProduct: NormalizedProductData;
  lowestWebPrice?: PriceScrapingResult;
  averageWebPrice: Decimal;
  priceRange: {
    min: Decimal;
    max: Decimal;
  };
  marginAnalysis: {
    currentMargin: number;
    potentialMargin: number;
    opportunity: boolean;
  };
}

// Alert types
export interface ScrapingAlert {
  id?: string;
  normalizedProductId: string;
  alertType: ScrapingAlertType;
  message: string;
  currentMargin: Decimal;
  targetMargin: Decimal;
  isRead: boolean;
  isResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ScrapingAlertType = 'MARGIN_OPPORTUNITY' | 'PRICE_DROP' | 'COMPETITOR_ALERT' | 'SUPPLY_ISSUE' | 'DATA_QUALITY';

// API request/response types
export interface ImportRequest {
  supplierId: string;
  file: File;
  mappingTemplateId?: string;
  autoMap?: boolean;
}

export interface ImportResponse {
  success: boolean;
  importId: string;
  totalRows: number;
  validRows: number;
  errors: string[];
  warnings: string[];
}

export interface PriceScanRequest {
  supplierId?: string;
  productIds?: string[];
  sources?: string[];
  priority?: 'low' | 'normal' | 'high';
}

export interface PriceScanResponse {
  success: boolean;
  jobId: string;
  estimatedDuration: number;
  totalProducts: number;
}

// Validation and error types
export interface ValidationError {
  row: number;
  field: string;
  message: string;
  data: Record<string, unknown>;
}

export interface ValidationWarning {
  row: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  validRows: number;
  invalidRows: number;
  totalRows: number;
}
