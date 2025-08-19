import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";

// Validation schema for product data
const productImportSchema = z.object({
  name: z
    .string()
    .min(1, "Productnaam is verplicht")
    .max(100, "Productnaam mag maximaal 100 tekens zijn"),
  brand: z.string().min(1, "Merk is verplicht").max(50, "Merk mag maximaal 50 tekens zijn"),
  content: z.string().min(1, "Inhoud is verplicht"),
  ean: z.string().regex(/^\d{13}$/, "EAN moet exact 13 cijfers bevatten"),
  purchasePrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Inkoopprijs moet een geldig bedrag zijn"),
  retailPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Verkoopprijs moet een geldig bedrag zijn"),
  stockQuantity: z.string().regex(/^\d+$/, "Voorraad moet een geheel getal zijn"),
  maxOrderableQuantity: z.string().optional(),
  starRating: z
    .string()
    .regex(/^[0-5]$/, "Sterrenrating moet tussen 0-5 zijn")
    .optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
});

export interface ImportError {
  row: number;
  field: string;
  message: string;
  data: Record<string, unknown>;
}

export interface ImportWarning {
  row: number;
  field: string;
  message: string;
}

export interface ImportProgress {
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  currentBatch: number;
  totalBatches: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  duplicates: ImportError[];
  isComplete: boolean;
}

export interface BatchResult {
  successful: number;
  failed: number;
  skipped: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  duplicates: ImportError[];
}

// Create snapshot of existing products before import
export async function createProductSnapshot(importId: string): Promise<void> {
  try {
    // Get all existing products
    const existingProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        brand: true,
        content: true,
        ean: true,
        purchasePrice: true,
        retailPrice: true,
        stockQuantity: true,
        maxOrderableQuantity: true,
        starRating: true,
        category: true,
        subcategory: true,
        description: true,
        tags: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create snapshot record
    await prisma.importSnapshot.create({
      data: {
        importId,
        entityType: "Product",
        snapshotData: existingProducts,
      },
    });
  } catch (error) {
    console.error("Error creating product snapshot:", error);
    throw new Error("Failed to create product snapshot");
  }
}

// Process a single product row
async function processProductRow(
  row: Record<string, unknown>,
  columnMapping: Record<string, string>,
  rowIndex: number,
  overwriteExisting: boolean = false,
): Promise<{ success: boolean; error?: ImportError; warning?: ImportWarning; skipped?: boolean; duplicate?: boolean }> {
  try {
    // Map CSV columns to product fields
    const mappedData: Record<string, unknown> = {};

    for (const [productField, csvColumn] of Object.entries(columnMapping)) {
      if (csvColumn && row[csvColumn] !== undefined) {
        mappedData[productField] = row[csvColumn];
      }
    }

    // Validate the mapped data
    const validatedData = productImportSchema.parse(mappedData);

    // Transform data for Prisma
    const productData = {
      name: validatedData.name,
      brand: validatedData.brand,
      content: validatedData.content,
      ean: validatedData.ean,
      purchasePrice: new Decimal(validatedData.purchasePrice),
      retailPrice: new Decimal(validatedData.retailPrice),
      stockQuantity: parseInt(validatedData.stockQuantity),
      maxOrderableQuantity: validatedData.maxOrderableQuantity
        ? parseInt(validatedData.maxOrderableQuantity)
        : null,
      starRating: validatedData.starRating ? parseInt(validatedData.starRating) : 0,
      category: validatedData.category || null,
      subcategory: validatedData.subcategory || null,
      description: validatedData.description || null,
      tags: validatedData.tags ? validatedData.tags.split(",").map((tag) => tag.trim()) : [],
    };

    // Check if product already exists
    // Validate EAN before database query
    if (!productData.ean || typeof productData.ean !== 'string' || productData.ean.trim() === '') {
      console.log(`⚠️ Row ${rowIndex + 1}: Invalid EAN value:`, { ean: productData.ean, type: typeof productData.ean });
      return {
        success: false,
        error: {
          row: rowIndex + 1,
          field: "ean",
          message: "EAN is required and cannot be empty",
          data: productData,
        },
      };
    }

    console.log(`🔍 Row ${rowIndex + 1}: Checking EAN uniqueness for: ${productData.ean}`);
    const existingProduct = await prisma.product.findUnique({
      where: { ean: productData.ean },
    });

    if (existingProduct && !overwriteExisting) {
      return {
        success: false,
        error: {
          row: rowIndex + 1,
          field: "ean",
          message: `Product met EAN ${productData.ean} bestaat al`,
          data: productData,
        },
      };
    }

    // Create or update the product
    try {
      if (existingProduct && overwriteExisting) {
        await prisma.product.update({
          where: { ean: productData.ean },
          data: productData,
        });
      } else {
        await prisma.product.create({
          data: productData,
        });
      }
    } catch (createError) {
      console.error(`Error creating/updating product for row ${rowIndex + 1}:`, createError);
      console.error(`Product data:`, productData);
      
      let errorMessage = "Failed to create/update product";
      if (createError instanceof Error) {
        if (createError.message.includes('Invalid `prisma.product.') || createError.message.includes('Invalid `prisma.product.create()`')) {
          errorMessage = `Database validation error: ${createError.message}`;
        } else {
          errorMessage = createError.message;
        }
      }
      
      return {
        success: false,
        error: {
          row: rowIndex + 1,
          field: "database",
          message: errorMessage,
          data: productData,
        },
      };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          row: rowIndex + 1,
          field: (error as z.ZodError).errors[0].path.join("."),
          message: (error as z.ZodError).errors[0].message,
          data: row,
        },
      };
    }

    return {
      success: false,
      error: {
        row: rowIndex + 1,
        field: "unknown",
        message: error instanceof Error ? error.message : "Onbekende fout",
        data: row,
      },
    };
  }
}

// Check for existing products in batch
async function checkExistingProducts(
  batch: Record<string, unknown>[],
  columnMapping: Record<string, string>,
  duplicateConfig: DuplicateDetectionConfig,
): Promise<Map<string, unknown>> {
  const existingProducts = new Map<string, unknown>();

  if (!duplicateConfig.checkEAN) {
    return existingProducts;
  }

  // Extract EAN codes from batch
  const eanCodes: string[] = [];
  const eanToRowIndex = new Map<string, number>();

  if (batch && Array.isArray(batch)) {
    batch.forEach((row, index) => {
      const eanColumn = columnMapping["ean"];
      if (eanColumn && row[eanColumn]) {
        const ean = row[eanColumn].toString().trim();
        if (ean && ean.length === 13) {
          eanCodes.push(ean);
          eanToRowIndex.set(ean, index);
        }
      }
    });
  }

  if (eanCodes.length === 0) {
    return existingProducts;
  }

  // Query existing products by EAN
  const existing = await prisma.product.findMany({
    where: {
      ean: { in: eanCodes },
    },
    select: {
      id: true,
      ean: true,
      name: true,
      brand: true,
    },
  });

  // Map existing products
  if (existing && Array.isArray(existing)) {
    existing.forEach((product) => {
      existingProducts.set(product.ean, product);
    });
  }

  return existingProducts;
}

// Process a batch of products with duplicate detection
export async function processBatch(
  batch: Record<string, unknown>[],
  columnMapping: Record<string, string>,
  startIndex: number,
  overwriteExisting: boolean = false,
  duplicateConfig: DuplicateDetectionConfig = {
    strategy: "skip",
    checkEAN: true,
    checkNameBrand: false,
  },
): Promise<BatchResult> {
  // Check for existing products first
  const existingProducts = await checkExistingProducts(batch, columnMapping, duplicateConfig);

  const results = await Promise.allSettled(
    batch.map(async (row, index) => {
      const eanColumn = columnMapping["ean"];
      const ean = eanColumn ? row[eanColumn]?.toString().trim() : null;

      // Check for duplicates
      if (ean && existingProducts.has(ean)) {
        const existingProduct = existingProducts.get(ean);

        switch (duplicateConfig.strategy) {
          case "skip":
            return {
              success: false,
              skipped: true,
              error: {
                row: startIndex + index + 1,
                field: "ean",
                message: `Product met EAN ${ean} bestaat al (overgeslagen)`,
                data: { ean, existingProduct },
              },
            };

          case "flag":
            return {
              success: false,
              duplicate: true,
              error: {
                row: startIndex + index + 1,
                field: "ean",
                message: `Product met EAN ${ean} bestaat al (gemarkeerd als duplicaat)`,
                data: { ean, existingProduct },
              },
            };

          case "error":
            return {
              success: false,
              error: {
                row: startIndex + index + 1,
                field: "ean",
                message: `Product met EAN ${ean} bestaat al`,
                data: { ean, existingProduct },
              },
            };

          case "overwrite":
            // Continue with overwrite
            return processProductRow(row, columnMapping, startIndex + index, true);
        }
      }

      // Process normally if no duplicate or strategy allows overwrite
      return processProductRow(row, columnMapping, startIndex + index, overwriteExisting);
    }),
  );

  let successful = 0;
  let failed = 0;
  let skipped = 0;
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  const duplicates: ImportError[] = [];

  if (results && Array.isArray(results)) {
    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        if (result.value.success) {
          successful++;
        } else if (result.value.skipped) {
          skipped++;
          if (result.value.error) {
            errors.push(result.value.error);
          }
        } else if (result.value.duplicate) {
          failed++;
          if (result.value.error) {
            duplicates.push(result.value.error);
          }
        } else {
          failed++;
          if (result.value.error) {
            errors.push(result.value.error);
          }
          if (result.value.warning) {
            warnings.push(result.value.warning);
          }
        }
      } else if (result.status === "rejected") {
        failed++;
        const batchItem = index < batch.length ? batch[index] : {};
        const errorMessage =
          typeof result.reason === "string"
            ? result.reason
            : result.reason instanceof Error
              ? result.reason.message
              : "Onbekende fout";
        errors.push({
          row: startIndex + index + 1,
          field: "unknown",
          message: errorMessage,
          data: batchItem,
        });
      }
    });
  }

  return { successful, failed, skipped, errors, warnings, duplicates };
}

// Duplicate detection strategies
export type DuplicateStrategy = "skip" | "overwrite" | "flag" | "error";

export interface DuplicateDetectionConfig {
  strategy: DuplicateStrategy;
  checkEAN: boolean;
  checkNameBrand: boolean;
}

// Main import function with progress tracking
export async function importProducts(
  data: Record<string, unknown>[],
  columnMapping: Record<string, string>,
  options: {
    batchSize?: number;
    overwriteExisting?: boolean;
    duplicateDetection?: DuplicateDetectionConfig;
    onProgress?: (progress: ImportProgress) => void;
    onError?: (error: string) => void;
    importId?: string; // Add importId for snapshot creation
  } = {},
): Promise<ImportProgress> {
  const {
    batchSize = 10,
    overwriteExisting = false,
    duplicateDetection = { strategy: "skip", checkEAN: true, checkNameBrand: false },
    onProgress,
    onError,
    importId,
  } = options;

  const totalRows = data.length;
  const totalBatches = Math.ceil(totalRows / batchSize);

  let processedRows = 0;
  let successfulRows = 0;
  let failedRows = 0;
  const allErrors: ImportError[] = [];
  const allWarnings: ImportWarning[] = [];

  const progress: ImportProgress = {
    totalRows,
    processedRows: 0,
    successfulRows: 0,
    failedRows: 0,
    skippedRows: 0,
    currentBatch: 0,
    totalBatches,
    errors: [],
    warnings: [],
    duplicates: [],
    isComplete: false,
  };

  try {
    // Create snapshot before import if importId is provided
    if (importId) {
      try {
        await createProductSnapshot(importId);
      } catch (error) {
        console.error("Failed to create snapshot:", error);
        // Continue with import even if snapshot fails
      }
    }

    // Process data in batches
    for (let i = 0; i < totalRows; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const currentBatch = Math.floor(i / batchSize) + 1;

      // Update progress
      progress.currentBatch = currentBatch;
      if (onProgress) {
        onProgress(progress);
      }

      // Process batch
      const batchResult = await processBatch(
        batch,
        columnMapping,
        i,
        overwriteExisting,
        duplicateDetection,
      );

      // Update counters
      successfulRows += batchResult.successful;
      failedRows += batchResult.failed;
      processedRows += batch.length;
      allErrors.push(...batchResult.errors);
      allWarnings.push(...batchResult.warnings);

      // Update progress
      progress.processedRows = processedRows;
      progress.successfulRows = successfulRows;
      progress.failedRows = failedRows;
      progress.errors = allErrors;
      progress.warnings = allWarnings;

      if (onProgress) {
        onProgress(progress);
      }

      // Add delay between batches to prevent overwhelming the database
      if (i + batchSize < totalRows) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Mark as complete
    progress.isComplete = true;
    if (onProgress) {
      onProgress(progress);
    }

    return progress;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Onbekende fout tijdens import";
    if (onError) {
      onError(errorMessage);
    }
    throw error;
  }
}
