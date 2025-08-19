import { Decimal } from "@prisma/client/runtime/library";
import { 
  NormalizedProductData, 
  PriceScrapingResult, 
  ProductMatch, 
  MatchingConfig, 
  PenaltyRule 
} from "../types";

export class ProductMatcher {
  private config: MatchingConfig;

  constructor(config?: Partial<MatchingConfig>) {
    this.config = {
      eanWeight: 1.0,
      brandSizeWeight: 0.9,
      fuzzyTitleWeight: 0.7,
      penaltyRules: [
        { pattern: 'tester', penalty: 0.3, description: 'Tester product penalty' },
        { pattern: 'gift set', penalty: 0.4, description: 'Gift set penalty' },
        { pattern: 'bundle', penalty: 0.3, description: 'Bundle product penalty' },
        { pattern: 'refill', penalty: 0.2, description: 'Refill product penalty' },
        { pattern: 'sample', penalty: 0.5, description: 'Sample product penalty' },
        { pattern: 'mini', penalty: 0.1, description: 'Mini size penalty' },
        { pattern: 'travel', penalty: 0.1, description: 'Travel size penalty' }
      ],
      ...config
    };
  }

  /**
   * Find matches for a normalized product from scraped results
   */
  findMatches(
    normalizedProduct: NormalizedProductData,
    scrapedResults: PriceScrapingResult[]
  ): ProductMatch {
    const matches: Array<PriceScrapingResult & { score: number }> = [];

    for (const result of scrapedResults) {
      const score = this.calculateMatchScore(normalizedProduct, result);
      if (score > 0.3) { // Minimum threshold for consideration
        matches.push({ ...result, score });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    // Find best match
    const bestMatch = matches.length > 0 ? matches[0] : undefined;

    // Calculate overall confidence score
    const confidenceScore = bestMatch ? bestMatch.score : 0;

    // Calculate margin opportunity if we have a best match
    let marginOpportunity: number | undefined;
    if (bestMatch) {
      const wholesalePrice = parseFloat(normalizedProduct.wholesalePrice.toString());
      const retailPrice = parseFloat(bestMatch.price.toString());
      if (retailPrice > 0) {
        marginOpportunity = ((retailPrice - wholesalePrice) / wholesalePrice) * 100;
      }
    }

    return {
      normalizedProduct,
      scrapedResults: matches.map(({ score, ...result }) => result),
      bestMatch: bestMatch ? { score: bestMatch.score, ...bestMatch } : undefined,
      confidenceScore,
      marginOpportunity
    };
  }

  /**
   * Calculate match score between normalized product and scraped result
   */
  private calculateMatchScore(
    normalized: NormalizedProductData,
    scraped: PriceScrapingResult
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    // EAN matching (highest priority)
    if (normalized.ean && this.matchEAN(normalized.ean, scraped.productTitle)) {
      totalScore += this.config.eanWeight;
      totalWeight += this.config.eanWeight;
    }

    // Brand + Size matching
    const brandSizeScore = this.calculateBrandSizeScore(normalized, scraped);
    if (brandSizeScore > 0) {
      totalScore += brandSizeScore * this.config.brandSizeWeight;
      totalWeight += this.config.brandSizeWeight;
    }

    // Fuzzy title matching
    const titleScore = this.calculateFuzzyTitleScore(normalized, scraped);
    if (titleScore > 0) {
      totalScore += titleScore * this.config.fuzzyTitleWeight;
      totalWeight += this.config.fuzzyTitleWeight;
    }

    // Apply penalties
    const penaltyScore = this.calculatePenaltyScore(scraped.productTitle);
    totalScore = Math.max(0, totalScore - penaltyScore);

    // Normalize score
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Check if EAN matches (exact match or embedded in title)
   */
  private matchEAN(ean: string, title: string): boolean {
    if (!ean || !title) return false;

    // Remove non-digits from title and check for EAN
    const titleDigits = title.replace(/\D/g, '');
    
    // Check for exact EAN match
    if (titleDigits.includes(ean)) {
      return true;
    }

    // Check for partial EAN match (last 8-10 digits)
    if (ean.length >= 8) {
      const partialEAN = ean.slice(-8);
      if (titleDigits.includes(partialEAN)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate brand and size matching score
   */
  private calculateBrandSizeScore(
    normalized: NormalizedProductData,
    scraped: PriceScrapingResult
  ): number {
    let score = 0;

    // Brand matching
    const brandMatch = this.fuzzyStringMatch(
      normalized.brand.toLowerCase(),
      scraped.productTitle.toLowerCase()
    );
    
    if (brandMatch > 0.8) {
      score += 0.6; // Brand is very similar
    } else if (brandMatch > 0.6) {
      score += 0.4; // Brand is somewhat similar
    } else if (brandMatch > 0.4) {
      score += 0.2; // Brand has some similarity
    }

    // Size matching
    if (normalized.variantSize && this.matchSize(normalized.variantSize, scraped.productTitle)) {
      score += 0.4; // Size matches
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate fuzzy title matching score
   */
  private calculateFuzzyTitleScore(
    normalized: NormalizedProductData,
    scraped: PriceScrapingResult
  ): number {
    const normalizedTitle = normalized.productName.toLowerCase();
    const scrapedTitle = scraped.productTitle.toLowerCase();

    // Remove common words that don't help with matching
    const normalizedClean = this.removeCommonWords(normalizedTitle);
    const scrapedClean = this.removeCommonWords(scrapedTitle);

    // Calculate similarity
    const similarity = this.fuzzyStringMatch(normalizedClean, scrapedClean);
    
    // Boost score if brand is mentioned in scraped title
    if (scrapedTitle.includes(normalized.brand.toLowerCase())) {
      return Math.min(1.0, similarity + 0.2);
    }

    return similarity;
  }

  /**
   * Calculate penalty score based on penalty rules
   */
  private calculatePenaltyScore(title: string): number {
    let totalPenalty = 0;
    const lowerTitle = title.toLowerCase();

    for (const rule of this.config.penaltyRules) {
      if (lowerTitle.includes(rule.pattern.toLowerCase())) {
        totalPenalty += rule.penalty;
      }
    }

    return totalPenalty;
  }

  /**
   * Check if size matches between normalized product and scraped title
   */
  private matchSize(normalizedSize: string, title: string): boolean {
    if (!normalizedSize || !title) return false;

    // Extract size from normalized product
    const sizeMatch = normalizedSize.match(/(\d+(?:\.\d+)?)(ml|l|g|kg)/i);
    if (!sizeMatch) return false;

    const [, size, unit] = sizeMatch;
    const normalizedSizeValue = parseFloat(size);
    const normalizedSizeUnit = unit.toLowerCase();

    // Extract sizes from title
    const titleSizeMatches = title.match(/(\d+(?:\.\d+)?)\s*(ml|milliliter|milliliters?|l|liter|liters?|g|gram|grams?|kg|kilogram|kilograms?)/gi);
    
    if (!titleSizeMatches) return false;

    for (const titleSizeMatch of titleSizeMatches) {
      const titleSizeMatchResult = titleSizeMatch.match(/(\d+(?:\.\d+)?)\s*(ml|milliliter|milliliters?|l|liter|liters?|g|gram|grams?|kg|kilogram|kilograms?)/i);
      if (!titleSizeMatchResult) continue;

      const [, titleSize, titleUnit] = titleSizeMatchResult;
      const titleSizeValue = parseFloat(titleSize);
      const titleSizeUnit = this.normalizeSizeUnit(titleUnit);

      // Check if sizes match (allow small tolerance)
      if (this.sizesMatch(normalizedSizeValue, normalizedSizeUnit, titleSizeValue, titleSizeUnit)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if two sizes match (with tolerance)
   */
  private sizesMatch(
    size1: number, 
    unit1: string, 
    size2: number, 
    unit2: string
  ): boolean {
    // Convert to common unit (ml for liquids, g for weights)
    const size1InCommon = this.convertToCommonUnit(size1, unit1);
    const size2InCommon = this.convertToCommonUnit(size2, unit2);

    if (size1InCommon === null || size2InCommon === null) return false;

    // Allow 5% tolerance
    const tolerance = Math.max(size1InCommon, size2InCommon) * 0.05;
    return Math.abs(size1InCommon - size2InCommon) <= tolerance;
  }

  /**
   * Convert size to common unit
   */
  private convertToCommonUnit(size: number, unit: string): number | null {
    const normalizedUnit = this.normalizeSizeUnit(unit);
    
    switch (normalizedUnit) {
      case 'ml':
        return size;
      case 'l':
        return size * 1000;
      case 'g':
        return size;
      case 'kg':
        return size * 1000;
      default:
        return null;
    }
  }

  /**
   * Normalize size unit
   */
  private normalizeSizeUnit(unit: string): string {
    const lowerUnit = unit.toLowerCase();
    
    if (lowerUnit.includes('ml') || lowerUnit.includes('milliliter')) return 'ml';
    if (lowerUnit.includes('l') || lowerUnit.includes('liter')) return 'l';
    if (lowerUnit.includes('g') || lowerUnit.includes('gram')) return 'g';
    if (lowerUnit.includes('kg') || lowerUnit.includes('kilogram')) return 'kg';
    
    return lowerUnit;
  }

  /**
   * Remove common words that don't help with matching
   */
  private removeCommonWords(text: string): string {
    const commonWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'within',
      'perfume', 'cologne', 'eau', 'de', 'parfum', 'spray', 'bottle'
    ];

    return text
      .split(' ')
      .filter(word => !commonWords.includes(word.toLowerCase()))
      .join(' ');
  }

  /**
   * Calculate fuzzy string similarity using Levenshtein distance
   */
  private fuzzyStringMatch(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0) return str2.length === 0 ? 1.0 : 0.0;
    if (str2.length === 0) return 0.0;

    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    return 1.0 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Update matching configuration
   */
  updateConfig(newConfig: Partial<MatchingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current matching configuration
   */
  getConfig(): MatchingConfig {
    return { ...this.config };
  }

  /**
   * Add custom penalty rule
   */
  addPenaltyRule(rule: PenaltyRule): void {
    this.config.penaltyRules.push(rule);
  }

  /**
   * Remove penalty rule by pattern
   */
  removePenaltyRule(pattern: string): void {
    this.config.penaltyRules = this.config.penaltyRules.filter(
      rule => rule.pattern !== pattern
    );
  }
}
