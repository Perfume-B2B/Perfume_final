import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { Decimal } from "decimal.js";

interface ImportResult {
  success: boolean;
  message: string;
  row?: number;
  field?: string;
}

interface ProductRow {
  name: string;
  brand: string;
  content: string;
  ean: string;
  purchasePrice: number;
  retailPrice: number;
  stockQuantity: number;
  maxOrderableQuantity?: number;
  starRating?: number;
  category?: string;
  subcategory?: string;
  description?: string;
  tags?: string;
  status?: string;
}

export async function POST(request: NextRequest) {
  console.log("🚀 Bulk import API called");
  
  try {
    // Check authentication
    console.log("🔐 Checking authentication...");
    const session = await auth();
    
    if (!session || session.user?.role !== "ADMIN") {
      console.log("❌ Authentication failed - no session or not admin");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.log("🔐 Session:", session ? { user: session.user?.username, role: session.user?.role } : "No session");
    
    console.log("✅ Authentication successful");
    
    // Parse form data
    console.log("📁 Reading form data...");
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      console.log("❌ No file provided");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    
    console.log("📁 File received:", {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });
    
    // Validate file type
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const isCSV = fileExtension === 'csv';
    const isExcel = fileExtension === 'xlsx' || fileExtension === 'xls';
    
    if (!validTypes.includes(file.type) && !isCSV && !isExcel) {
      return NextResponse.json(
        { error: "Invalid file type. Only CSV and Excel files are allowed." },
        { status: 400 }
      );
    }
    
    console.log("✅ File type validation passed");
    
    // Process file in memory
    console.log("💾 Processing file in memory...");
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log("💾 File buffer created:", buffer.length, "bytes");
    
    // Parse file based on type
    console.log("📊 Starting file parsing...");
    let rows: any[] = [];
    
    if (isCSV || file.type === "text/csv") {
      console.log("📊 Parsing as CSV...");
      const csvText = buffer.toString('utf-8');
      console.log("📊 CSV text length:", csvText.length);
      
      const workbook = XLSX.read(csvText, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet);
    } else if (isExcel || file.type.includes("excel") || file.type.includes("spreadsheet")) {
      console.log("📊 Parsing as Excel...");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet);
    }
    
    console.log("📊 Parsed rows:", rows.length);
    if (rows.length > 0) {
      console.log("📊 First row sample:", rows[0]);
    }
    
    if (rows.length === 0) {
      console.log("❌ No data rows found in file");
      return NextResponse.json({ error: "No data rows found in file" }, { status: 400 });
    }

    // Log all available columns to help with debugging
    if (rows.length > 0) {
      const availableColumns = Object.keys(rows[0]);
      console.log("📋 Available columns in file:", availableColumns);
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

    const results: ImportResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1; // +1 because we're 0-indexed and want to show actual row numbers

      try {
        // Validate required fields
        const requiredFields = ["name", "brand", "content", "ean", "purchasePrice", "retailPrice"];
        for (const field of requiredFields) {
          if (!row[field as keyof typeof row]) {
            results.push({
              success: false,
              message: `Missing required field: ${field}`,
              row: rowNumber,
              field,
            });
            errorCount++;
            continue;
          }
        }

        // Validate EAN before database query - accept both string and number types
        let eanValue = row.ean;
        if (eanValue === undefined || eanValue === null) {
          console.log(`⚠️ Row ${rowNumber}: Missing EAN value`);
          results.push({
            success: false,
            message: "EAN is required and cannot be empty",
            row: rowNumber,
            field: "ean",
          });
          errorCount++;
          continue;
        }
        
        // Convert EAN to string and clean it
        let eanString = eanValue.toString().trim();
        
        // Remove any non-digit characters (spaces, dashes, etc.)
        eanString = eanString.replace(/\D/g, '');
        
        if (eanString === '' || eanString.length !== 13 || !/^\d{13}$/.test(eanString)) {
          console.log(`⚠️ Row ${rowNumber}: Invalid EAN format:`, { 
            original: eanValue, 
            cleaned: eanString, 
            length: eanString.length 
          });
          results.push({
            success: false,
            message: `EAN must be exactly 13 digits, got: ${eanString} (${eanString.length} characters)`,
            row: rowNumber,
            field: "ean",
          });
          errorCount++;
          continue;
        }
        
        console.log(`🔍 Row ${rowNumber}: Checking EAN uniqueness for: ${eanString}`);
        
        // Check if product already exists
        let existingProduct;
        try {
          existingProduct = await prisma.product.findUnique({
            where: { ean: eanString },
          });
        } catch (dbError) {
          console.error(`Database error checking EAN ${eanString} for row ${rowNumber}:`, dbError);
          results.push({
            success: false,
            message: `Database error checking EAN: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`,
            row: rowNumber,
            field: "database",
          });
          errorCount++;
          continue;
        }

        if (existingProduct) {
          results.push({
            success: false,
            message: `EAN ${eanString} already exists`,
            row: rowNumber,
            field: "ean",
          });
          errorCount++;
          continue;
        }

        // Validate numeric fields
        const numericFields = ["purchasePrice", "retailPrice", "stockQuantity"];
        for (const field of numericFields) {
          if (row[field as keyof typeof row] && isNaN(Number(row[field as keyof typeof row]))) {
            results.push({
              success: false,
              message: `Invalid numeric value for ${field}`,
              row: rowNumber,
              field,
            });
            errorCount++;
            continue;
          }
        }

        // Parse tags
        const tags = row.tags ? row.tags.split(",").map((tag: string) => tag.trim()) : [];

        console.log(`Creating product for row ${rowNumber}:`, {
          name: row.name,
          brand: row.brand,
          content: row.content,
          ean: eanString,
          purchasePrice: row.purchasePrice,
          retailPrice: row.retailPrice,
          stockQuantity: row.stockQuantity
        });

        // Create product with proper Decimal types
        let product = null;
        try {
          // Additional validation before creating product
          if (!row.name || !row.brand || !row.content || !eanString) {
            throw new Error(`Missing required fields: name=${!!row.name}, brand=${!!row.brand}, content=${!!row.content}, ean=${!!eanString}`);
          }

          product = await prisma.product.create({
            data: {
              name: row.name,
              brand: row.brand,
              content: row.content,
              ean: eanString,
              purchasePrice: new Decimal(row.purchasePrice),
              retailPrice: new Decimal(row.retailPrice),
              stockQuantity: parseInt(row.stockQuantity) || 0,
              maxOrderableQuantity: row.maxOrderableQuantity ? parseInt(row.maxOrderableQuantity) : 10,
              starRating: row.starRating ? parseInt(row.starRating) : 0,
              category: row.category || "Uncategorized",
              subcategory: row.subcategory || "",
              description: row.description || "",
              tags,
              status: row.status || "ACTIEF",
              isActive: true,
            },
          });
        } catch (createError) {
          console.error(`Error creating product for row ${rowNumber}:`, createError);
          console.error(`Row data:`, row);
          
          let errorMessage = "Failed to create product";
          if (createError instanceof Error) {
            if (createError.message.includes('Invalid `prisma.product.create()`')) {
              errorMessage = `Database validation error: ${createError.message}`;
            } else if (createError.message.includes('Missing required fields')) {
              errorMessage = createError.message;
            } else {
              errorMessage = createError.message;
            }
          }
          
          results.push({
            success: false,
            message: errorMessage,
            row: rowNumber,
            field: "database",
          });
          errorCount++;
          continue;
        }

        if (!product) {
          results.push({
            success: false,
            message: "Product creation failed - no product returned",
            row: rowNumber,
            field: "database",
          });
          errorCount++;
          continue;
        }

        console.log(`Product created successfully:`, product.id);

        results.push({
          success: true,
          message: `Product "${row.name}" successfully imported`,
          row: rowNumber,
        });

        successCount++;
      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error);
        results.push({
          success: false,
          message: `Error processing row: ${error instanceof Error ? error.message : "Unknown error"}`,
          row: rowNumber,
        });
        errorCount++;
      }
    }

    // No temp file cleanup needed since we process in memory
    console.log("✅ Import processing completed");

    return NextResponse.json({
      results,
      summary: {
        total: rows.length,
        success: successCount,
        errors: errorCount,
      },
    });
  } catch (error) {
    console.error("💥 Bulk import error:", error);
    console.error("💥 Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    // More specific error handling
    if (error instanceof Error) {
      if (error.message.includes('auth')) {
        console.error("💥 Authentication related error");
        return NextResponse.json({ error: "Authentication error", details: error.message }, { status: 401 });
      }
      if (error.message.includes('database') || error.message.includes('prisma')) {
        console.error("💥 Database related error");
        return NextResponse.json({ error: "Database error", details: error.message }, { status: 500 });
      }
      if (error.message.includes('file') || error.message.includes('parse')) {
        console.error("💥 File parsing related error");
        return NextResponse.json({ error: "File parsing error", details: error.message }, { status: 400 });
      }
    }
    
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 