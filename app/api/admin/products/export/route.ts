import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Parser } from "json2csv";
import * as XLSX from "xlsx";
import { toSafeString } from "@/lib/utils/decimal";

export interface ExportFilters {
  brand?: string;
  category?: string;
  subcategory?: string;
  status?: string;
  availability?: "in_stock" | "out_of_stock" | "all";
  minRating?: number;
  maxRating?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

export interface ExportOptions {
  format: "csv" | "excel";
  columns: string[];
  filters: ExportFilters;
  includePricing?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { format, columns, filters, includePricing = false }: ExportOptions = body;

    // Build where clause based on filters
    const where: any = {};

    if (filters.brand) {
      where.brand = { contains: filters.brand, mode: "insensitive" };
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.subcategory) {
      where.subcategory = filters.subcategory;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.availability && filters.availability !== "all") {
      where.isActive = filters.availability === "in_stock";
    }

    if (filters.minRating || filters.maxRating) {
      where.starRating = {};
      if (filters.minRating) where.starRating.gte = filters.minRating;
      if (filters.maxRating) where.starRating.lte = filters.maxRating;
    }

    if (filters.minPrice || filters.maxPrice) {
      where.retailPrice = {};
      if (filters.minPrice) where.retailPrice.gte = filters.minPrice;
      if (filters.maxPrice) where.retailPrice.lte = filters.maxPrice;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { brand: { contains: filters.search, mode: "insensitive" } },
        { ean: { contains: filters.search, mode: "insensitive" } },
        { content: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Fetch products with filters
    const products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
    });

    // Transform data based on selected columns
    const exportData = products.map((product) => {
      const row: Record<string, unknown> = {};

      columns.forEach((column) => {
        switch (column) {
          case "name":
            row["Product Naam"] = product.name;
            break;
          case "brand":
            row["Merk"] = product.brand;
            break;
          case "content":
            row["Inhoud/Grootte"] = product.content;
            break;
          case "ean":
            row["EAN Code"] = product.ean;
            break;
          case "purchasePrice":
            row["Inkoopprijs"] = toSafeString(product.purchasePrice);
            break;
          case "retailPrice":
            row["Verkoopprijs"] = toSafeString(product.retailPrice);
            break;
          case "stockQuantity":
            row["Voorraad"] = toSafeString(product.stockQuantity);
            break;
          case "maxOrderQuantity":
            row["Max Bestelling"] = toSafeString(product.maxOrderableQuantity);
            break;
          case "rating":
            row["Sterren"] = toSafeString(product.starRating);
            break;
          case "category":
            row["Categorie"] = product.category || "";
            break;
          case "subcategory":
            row["Subcategorie"] = product.subcategory || "";
            break;
          case "status":
            row["Status"] = product.status || "";
            break;
          case "isAvailable":
            row["Beschikbaar"] = product.isActive ? "Ja" : "Nee";
            break;
          case "description":
            row["Beschrijving"] = product.description || "";
            break;
          case "tags":
            row["Tags"] = product.tags?.join(", ") || "";
            break;
          case "createdAt":
            row["Aangemaakt"] = product.createdAt?.toLocaleDateString("nl-NL") || "";
            break;
          case "updatedAt":
            row["Bijgewerkt"] = product.updatedAt?.toLocaleDateString("nl-NL") || "";
            break;
        }
      });

      return row;
    });

    let fileBuffer: Buffer;
    let filename: string;
    let contentType: string;

    if (format === "csv") {
      // Generate CSV
      const parser = new Parser({
        fields: columns.map((col) => {
          const fieldMap: { [key: string]: string } = {
            name: "Product Naam",
            brand: "Merk",
            content: "Inhoud/Grootte",
            ean: "EAN Code",
            purchasePrice: "Inkoopprijs",
            retailPrice: "Verkoopprijs",
            stockQuantity: "Voorraad",
            maxOrderQuantity: "Max Bestelling",
            rating: "Sterren",
            category: "Categorie",
            subcategory: "Subcategorie",
            status: "Status",
            isAvailable: "Beschikbaar",
            description: "Beschrijving",
            tags: "Tags",
            createdAt: "Aangemaakt",
            updatedAt: "Bijgewerkt",
          };
          return fieldMap[col] || col;
        }),
      });

      const csv = parser.parse(exportData);
      fileBuffer = Buffer.from(csv, "utf-8");
      filename = `producten_export_${new Date().toISOString().split("T")[0]}.csv`;
      contentType = "text/csv";
    } else {
      // Generate Excel
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-size columns
      const columnWidths = columns.map((col) => {
        const maxLength = Math.max(
          col.length,
          ...exportData.map((row: Record<string, unknown>) => {
            const value = row[Object.keys(row).find((k2) => k2.includes(col)) || ""] || "";
            return value.toString().length;
          }),
        );
        return { width: Math.min(maxLength + 2, 50) };
      });

      worksheet["!cols"] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, "Producten");
      fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
      filename = `producten_export_${new Date().toISOString().split("T")[0]}.xlsx`;
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    // Get current user for export history
    const userId = session?.user?.id;

    // Log export history
    if (userId) {
      try {
        await prisma.exportHistory.create({
          data: {
            userId,
            exportType: "PRODUCT",
            exportFormat: format.toUpperCase(),
            fileName: filename,
            fileSize: fileBuffer.length,
            parameters: {
              format,
              columns,
              filters,
              includePricing,
            } as any,
            recordCount: products.length,
            status: "SUCCESS",
          },
        });
      } catch (error) {
        console.error("Failed to log export history:", error);
        // Don't fail the export if history logging fails
      }
    }

    // Create response with file download
    const response = new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });

    return response;
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Return available columns for export
    const availableColumns = [
      { key: "name", label: "Product Naam" },
      { key: "brand", label: "Merk" },
      { key: "content", label: "Inhoud/Grootte" },
      { key: "ean", label: "EAN Code" },
      { key: "purchasePrice", label: "Inkoopprijs" },
      { key: "retailPrice", label: "Verkoopprijs" },
      { key: "stockQuantity", label: "Voorraad" },
      { key: "maxOrderQuantity", label: "Max Bestelling" },
      { key: "rating", label: "Sterren" },
      { key: "category", label: "Categorie" },
      { key: "subcategory", label: "Subcategorie" },
      { key: "isAvailable", label: "Beschikbaar" },
      { key: "description", label: "Beschrijving" },
      { key: "tags", label: "Tags" },
      { key: "createdAt", label: "Aangemaakt" },
      { key: "updatedAt", label: "Bijgewerkt" },
    ];

    return NextResponse.json({ availableColumns });
  } catch (error) {
    console.error("Error fetching export options:", error);
    return NextResponse.json({ error: "Failed to fetch export options" }, { status: 500 });
  }
}
