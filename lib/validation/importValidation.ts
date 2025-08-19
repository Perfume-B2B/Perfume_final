import { z } from "zod";

// Product validation schema
const productSchema = z.object({
  name: z.string().min(1, "Productnaam is verplicht"),
  brand: z.string().min(1, "Merk is verplicht"),
  content: z.string().min(1, "Inhoud/grootte is verplicht"),
  ean: z
    .string()
    .length(13, "EAN moet exact 13 cijfers zijn")
    .regex(/^\d{13}$/, "EAN mag alleen cijfers bevatten"),
  purchasePrice: z
    .string()
    .min(1, "Inkoopprijs is verplicht")
    .regex(/^\d+(\.\d{1,2})?$/, "Inkoopprijs moet een geldig bedrag zijn"),
  retailPrice: z
    .string()
    .min(1, "Verkoopprijs is verplicht")
    .regex(/^\d+(\.\d{1,2})?$/, "Verkoopprijs moet een geldig bedrag zijn"),
  stockQuantity: z
    .string()
    .min(1, "Voorraad is verplicht")
    .regex(/^\d+$/, "Voorraad moet een geheel getal zijn"),
  maxOrderQuantity: z.string().optional(),
  rating: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
});

export interface ValidationRow {
  row: number;
  data: Record<string, unknown>;
  status: "valid" | "warning" | "error";
  errors?: string[];
  warnings?: string[];
  isDuplicate?: boolean;
}

export interface ValidationResult {
  rows: ValidationRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  duplicateRows: number;
  canImport: boolean;
}

export function validateImportData(
  data: Record<string, unknown>[],
  columnMapping: Record<string, string>,
  duplicates: Array<{
    row: number;
    field: string;
    message: string;
    data: Record<string, unknown>;
  }> = [],
): ValidationResult {
  const validationRows: ValidationRow[] = [];
  let validRows = 0;
  let errorRows = 0;
  let warningRows = 0;
  let duplicateRows = 0;

  // Create a map of duplicate rows for quick lookup
  const duplicateRowMap = new Map<number, boolean>();
  if (duplicates && Array.isArray(duplicates)) {
    duplicates.forEach((dup) => {
      duplicateRowMap.set(dup.row, true);
    });
  }

  if (data && Array.isArray(data)) {
    data.forEach((row, index) => {
    const rowNumber = index + 1;
    const mappedData: Record<string, unknown> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    // Map data according to column mapping
    for (const [productField, csvColumn] of Object.entries(columnMapping)) {
      if (csvColumn && row[csvColumn] !== undefined) {
        mappedData[productField] = row[csvColumn];
      }
    }

    // Check for duplicates
    const isDuplicate = duplicateRowMap.has(rowNumber);
    if (isDuplicate) {
      duplicateRows++;
    }

    // Validate required fields
    const requiredFields = [
      "name",
      "brand",
      "content",
      "ean",
      "purchasePrice",
      "retailPrice",
      "stockQuantity",
    ];
    const missingFields = requiredFields.filter((field) => !mappedData[field]);

    if (missingFields.length > 0) {
      errors.push(`Verplichte velden ontbreken: ${missingFields.join(", ")}`);
    }

    // Validate data types and formats
    try {
      const validatedData = productSchema.parse(mappedData);

      // Additional business logic validations
      const purchasePrice = parseFloat(validatedData.purchasePrice);
      const retailPrice = parseFloat(validatedData.retailPrice);
      const stockQuantity = parseInt(validatedData.stockQuantity);

      // Check if retail price is higher than purchase price
      if (retailPrice <= purchasePrice) {
        warnings.push("Verkoopprijs moet hoger zijn dan inkoopprijs");
      }

      // Check if stock is reasonable
      if (stockQuantity > 10000) {
        warnings.push("Voorraad lijkt onrealistisch hoog (>10.000)");
      }

      // Check EAN format
      if (validatedData.ean && !/^\d{13}$/.test(validatedData.ean)) {
        errors.push("EAN moet exact 13 cijfers bevatten");
      }

      // Check price formats
      if (purchasePrice <= 0) {
        errors.push("Inkoopprijs moet groter zijn dan 0");
      }
      if (retailPrice <= 0) {
        errors.push("Verkoopprijs moet groter zijn dan 0");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        if (error.errors && Array.isArray(error.errors)) {
          error.errors.forEach((err: any) => {
            if (err && err.message) {
              errors.push(err.message);
            }
          });
        }
      } else {
        errors.push("Onbekende validatiefout");
      }
    }

    // Determine status
    let status: "valid" | "warning" | "error" = "valid";
    if (errors.length > 0) {
      status = "error";
    } else if (warnings.length > 0 || isDuplicate) {
      status = "warning";
    }

    // Count statistics
    if (status === "valid") {
      validRows++;
    } else if (status === "error") {
      errorRows++;
    } else if (status === "warning") {
      warningRows++;
    }

    validationRows.push({
      row: rowNumber,
      data: mappedData,
      status,
      ...(errors.length > 0 && { errors }),
      ...(warnings.length > 0 && { warnings }),
      isDuplicate,
    });
  });
  }

  const canImport = validRows > 0 || (warningRows > 0 && errorRows === 0);

  return {
    rows: validationRows,
    totalRows: data ? data.length : 0,
    validRows,
    errorRows,
    warningRows,
    duplicateRows,
    canImport,
  };
}

export function filterValidRows(
  validationResult: ValidationResult,
  importOnlyValid: boolean,
): Record<string, unknown>[] {
  if (importOnlyValid) {
    return validationResult.rows.filter((row) => row.status === "valid").map((row) => row.data);
  } else {
    return validationResult.rows.filter((row) => row.status !== "error").map((row) => row.data);
  }
}
