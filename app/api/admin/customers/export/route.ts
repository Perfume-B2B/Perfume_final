import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Parser } from "json2csv";
import { auth } from "@/lib/auth";

export interface CustomerExportFilters {
  status?: "active" | "inactive" | "all";
  country?: string;
  search?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const country = searchParams.get("country") || "";
    const search = searchParams.get("search") || "";

    // Build where clause based on filters
    const where: Record<string, unknown> = {};

    if (status && status !== "all") {
      where.isActive = status === "active";
    }

    if (country) {
      where.country = country;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    // Fetch customers with related data
    const customers = await prisma.customer.findMany({
      where,
      include: {
        customerMargins: true,
        customerDiscounts: true,
        hiddenCategories: true,
      },
      orderBy: { name: "asc" },
    });

    // Transform data for export
    const exportData = customers.map((customer) => ({
      "Klant ID": customer.id,
      Naam: customer.name,
      Email: customer.email,
      Telefoon: customer.phone || "",
      Adres: customer.address || "",
      "Algemene Marge (%)": customer.generalMargin.toString(),
      "Minimum Bestelwaarde": customer.minimumOrderValue.toString(),
      "Minimum Aantal Items": customer.minimumOrderItems.toString(),
      Status: customer.isActive ? "Actief" : "Inactief",
      Aangemaakt: customer.createdAt.toLocaleDateString("nl-NL"),
      Bijgewerkt: customer.updatedAt.toLocaleDateString("nl-NL"),
      "Categorie Marges": customer.customerMargins
        .map((cm) => `${cm.category}: ${cm.margin}%`)
        .join("; "),
      "Merk Kortingen": customer.customerDiscounts
        .map((cd) => `${cd.brand}: ${cd.discount}%`)
        .join("; "),
      "Verborgen Categorieën": customer.hiddenCategories.map((hc) => hc.category).join("; "),
    }));

    // Generate CSV
    const parser = new Parser({
      fields: [
        "Klant ID",
        "Naam",
        "Email",
        "Telefoon",
        "Adres",
        "Algemene Marge (%)",
        "Minimum Bestelwaarde",
        "Minimum Aantal Items",
        "Status",
        "Aangemaakt",
        "Bijgewerkt",
        "Categorie Marges",
        "Merk Kortingen",
        "Verborgen Categorieën",
      ],
    });

    const csv = parser.parse(exportData);
    const fileBuffer = Buffer.from(csv, "utf-8");
    const filename = `klanten_export_${new Date().toISOString().split("T")[0]}.csv`;

    // Return CSV file
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting customers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
