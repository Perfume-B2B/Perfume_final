import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";

// Validation schemas
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

const importRequestSchema = z.object({
  data: z.array(z.record(z.string())),
  columnMapping: z.record(z.string()),
  overwriteExisting: z.boolean().default(false),
  validateData: z.boolean().default(true),
});

interface ImportError {
  row: number;
  field: string;
  message: string;
  data: Record<string, unknown>;
}

interface ImportWarning {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  processingTime: number;
  importId?: string; // Added importId to the interface
}

// Process a single product row
async function processProductRow(
  row: Record<string, unknown>,
  columnMapping: Record<string, string>,
  rowIndex: number,
): Promise<{ success: boolean; error?: ImportError; warning?: ImportWarning }> {
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
      tags: validatedData.tags
        ? validatedData.tags.split(",").map((tag: string) => tag.trim())
        : [],
    };

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
    // Check if product already exists
    const existingProduct = await prisma.product.findUnique({
      where: { ean: productData.ean },
    });

    if (existingProduct) {
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

    // Create the product
    try {
      await prisma.product.create({
        data: productData,
      });
    } catch (createError) {
      console.error(`Error creating product for row ${rowIndex + 1}:`, createError);
      console.error(`Product data:`, productData);
      
      let errorMessage = "Failed to create product";
      if (createError instanceof Error) {
        if (createError.message.includes('Invalid `prisma.product.create()`')) {
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
          field: error.errors[0]?.path?.join?.(".") ?? "unknown",
          message: error.errors[0]?.message ?? "Ongeldige data",
          data: (row as Record<string, unknown>) || {},
        },
      };
    }

    return {
      success: false,
      error: {
        row: rowIndex + 1,
        field: "unknown",
        message: error instanceof Error ? error.message : "Onbekende fout",
        data: (row as Record<string, unknown>) || {},
      },
    };
  }
}

// Process data in batches
async function processBatch(
  batch: Record<string, unknown>[],
  columnMapping: Record<string, string>,
  startIndex: number,
): Promise<{
  successful: number;
  failed: number;
  errors: ImportError[];
  warnings: ImportWarning[];
}> {
  const results = await Promise.allSettled(
    batch.map((row, index) => processProductRow(row, columnMapping, startIndex + index)),
  );

  let successful = 0;
  let failed = 0;
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];

  if (results && Array.isArray(results)) {
    results.forEach((result, index) => {
      if (result && result.status === "fulfilled" && result.value) {
        if (result.value.success) {
          successful++;
        } else {
          failed++;
          if (result.value.error) {
            errors.push(result.value.error);
          }
          if (result.value.warning) {
            warnings.push(result.value.warning);
          }
        }
      } else if (result && result.status === "rejected") {
        failed++;
        const batchItem = index < batch.length ? batch[index] : {};
        errors.push({
          row: startIndex + index + 1,
          field: "unknown",
          message: result.reason?.message || "Onbekende fout",
          data: batchItem || {},
        });
      }
    });
  }

  return { successful, failed, errors, warnings };
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { data, columnMapping } = importRequestSchema.parse(body);

    // Log column mapping and data structure for debugging
    console.log("🔧 Column mapping received:", columnMapping);
    if (data.length > 0) {
      const availableColumns = Object.keys(data[0]);
      console.log("📋 Available columns in data:", availableColumns);
      console.log("🔍 Looking for required columns: name, brand, content, ean, purchasePrice, retailPrice, stockQuantity");
      
      // Check which required columns are missing
      const requiredColumns = ["name", "brand", "content", "ean", "purchasePrice", "retailPrice", "stockQuantity"];
      const missingColumns = requiredColumns.filter(col => !availableColumns.includes(col));
      if (missingColumns.length > 0) {
        console.log("❌ Missing required columns:", missingColumns);
      } else {
        console.log("✅ All required columns found");
      }
    }

    const startTime = Date.now();
    const batchSize = 50;
    let totalSuccessful = 0;
    let totalFailed = 0;
    const allErrors: ImportError[] = [];
    const allWarnings: ImportWarning[] = [];

    // Process data in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchResult = await processBatch(batch, columnMapping, i);
      totalSuccessful += batchResult.successful;
      totalFailed += batchResult.failed;
      allErrors.push(...batchResult.errors);
      allWarnings.push(...batchResult.warnings);
    }

    const processingTime = Date.now() - startTime;

    // Create import history record
    const importHistory = await prisma.importHistory.create({
      data: {
        fileName: "bulk-import.csv",
        fileType: "CSV",
        entityType: "PRODUCT",
        totalRows: data.length,
        importedRows: totalSuccessful,
        failedRows: totalFailed,
        errors: allErrors as unknown as Prisma.InputJsonValue,
        // processingTime,
        importedBy: (session.user as { id: string })?.id || "",
      },
    });

    const result: ImportResult = {
      success: totalFailed === 0,
      totalRows: data.length,
      successfulRows: totalSuccessful,
      failedRows: totalFailed,
      errors: allErrors,
      warnings: allWarnings,
      processingTime,
      importId: importHistory.id, // Add importId to response
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Bulk import error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Ongeldige data",
          details: error.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Interne server fout",
      },
      { status: 500 },
    );
  }
}
