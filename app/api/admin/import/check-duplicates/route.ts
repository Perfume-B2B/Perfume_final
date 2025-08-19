import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { data, columnMapping, checkEAN = true, checkNameBrand = false } = body;

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    const duplicates: Array<{
      row: number;
      field: string;
      message: string;
      data: Record<string, unknown>;
    }> = [];

    // Check EAN duplicates
    if (checkEAN) {
      const eanColumn = columnMapping?.ean;
      if (eanColumn) {
        const eanCodes = data
          .map((row, index) => ({
            ean: row[eanColumn]?.toString().trim(),
            index,
          }))
          .filter((item) => item.ean && item.ean.length === 13);

        if (eanCodes.length > 0) {
          const existingProducts = await prisma.product.findMany({
            where: {
              ean: { in: eanCodes.map((item) => item.ean) },
            },
            select: {
              id: true,
              ean: true,
              name: true,
              brand: true,
            },
          });

          const existingEANs = new Set(existingProducts.map((p) => p.ean));

          if (eanCodes && Array.isArray(eanCodes)) {
            eanCodes.forEach((item) => {
              if (item && typeof item === 'object' && item.ean && typeof item.index === 'number') {
                const { ean, index } = item;
                if (existingEANs.has(ean)) {
                  const existingProduct = existingProducts.find((p) => p.ean === ean);
                  duplicates.push({
                    row: index + 1,
                    field: "ean",
                    message: `Product met EAN ${ean} bestaat al`,
                    data: { ean, existingProduct },
                  });
                }
              }
            });
          }
        }
      }
    }

    // Check name + brand duplicates
    if (checkNameBrand) {
      const nameColumn = columnMapping?.name;
      const brandColumn = columnMapping?.brand;

      if (nameColumn && brandColumn) {
        const nameBrandPairs = data
          .map((row, index) => ({
            name: row[nameColumn]?.toString().trim(),
            brand: row[brandColumn]?.toString().trim(),
            index,
          }))
          .filter((item) => item.name && item.brand);

        if (nameBrandPairs.length > 0) {
          const existingProducts = await prisma.product.findMany({
            where: {
              OR: nameBrandPairs.map((item) => ({
                AND: {
                  name: item.name,
                  brand: item.brand,
                },
              })),
            },
            select: {
              id: true,
              name: true,
              brand: true,
              ean: true,
            },
          });

          const existingPairs = new Set(existingProducts.map((p) => `${p.name}|${p.brand}`));

          if (nameBrandPairs && Array.isArray(nameBrandPairs)) {
            nameBrandPairs.forEach((item) => {
              if (item && typeof item === 'object' && item.name && item.brand && typeof item.index === 'number') {
                const { name, brand, index } = item;
                const pair = `${name}|${brand}`;
                if (existingPairs.has(pair)) {
                  const existingProduct = existingProducts.find(
                    (p) => p.name === name && p.brand === brand,
                  );
                  duplicates.push({
                    row: index + 1,
                    field: "name",
                    message: `Product met naam "${name}" en merk "${brand}" bestaat al`,
                    data: { name, brand, existingProduct },
                  });
                }
              }
            });
          }
        }
      }
    }

    return NextResponse.json({
      duplicates,
      duplicateCount: duplicates.length,
      totalRows: data.length,
    });
  } catch (error) {
    console.error("Duplicate check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
