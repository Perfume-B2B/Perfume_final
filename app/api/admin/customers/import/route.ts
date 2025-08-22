import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { parse } from "csv-parse/sync";

// Zod schema voor customer import validatie
const customerImportSchema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  email: z.string().email("Geldig email adres is verplicht"),
  phone: z.string().optional(),
  address: z.string().optional(),
  generalMargin: z.string().transform((val) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > 100) {
      throw new Error("Algemene marge moet tussen 0 en 100% liggen");
    }
    return num;
  }),
  minimumOrderValue: z.string().transform((val) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      throw new Error("Minimum bestelwaarde moet een positief getal zijn");
    }
    return num;
  }),
  minimumOrderItems: z.string().transform((val) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) {
      throw new Error("Minimum aantal items moet een positief geheel getal zijn");
    }
    return num;
  }),
  status: z.string().transform((val) => {
    const status = val.toLowerCase();
    if (status === "actief" || status === "active") return true;
    if (status === "inactief" || status === "inactive") return false;
    throw new Error("Status moet 'Actief' of 'Inactief' zijn");
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Geen bestand geüpload" }, { status: 400 });
    }

    // Read and parse CSV
    const csvText = await file.text();
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const results = {
      total: records.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string; data: Record<string, unknown> }>,
    };

    // Process each row
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNumber = i + 2; // +2 because of 0-based index and header row

      try {
        // Validate row data
        const validatedData = customerImportSchema.parse(row);

        // Check if email already exists
        const existingCustomer = await prisma.customer.findUnique({
          where: { email: validatedData.email },
        });

        if (existingCustomer) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            error: "Email adres bestaat al",
            data: row,
          });
          continue;
        }

        // Create customer
        await prisma.customer.create({
          data: {
            name: validatedData.name,
            email: validatedData.email,
            phone: validatedData.phone || null,
            address: validatedData.address || null,
            generalMargin: validatedData.generalMargin,
            minimumOrderValue: validatedData.minimumOrderValue,
            minimumOrderItems: validatedData.minimumOrderItems,
            isActive: validatedData.status,
          },
        });

        results.successful++;
      } catch (error) {
        results.failed++;
        if (error instanceof z.ZodError) {
          results.errors.push({
            row: rowNumber,
            error: error.errors[0]?.message || "Validatie fout",
            data: row,
          });
        } else {
          results.errors.push({
            row: rowNumber,
            error: error instanceof Error ? error.message : "Onbekende fout",
            data: row,
          });
        }
      }
    }

    return NextResponse.json({
      message: "Import voltooid",
      results,
    });
  } catch (error) {
    console.error("Error importing customers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
