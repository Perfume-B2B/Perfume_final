import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { DataNormalizer } from '@/lib/scraping/normalization/DataNormalizer';
import { ColumnMapping, ImportRequest, ImportResponse } from '@/lib/scraping/types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ImportRequest = await request.json();
    const { supplierId, columnMapping, rows, fileName } = body;

    if (!supplierId || !columnMapping || !rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: supplierId, columnMapping, or rows' },
        { status: 400 }
      );
    }

    // Validate supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Initialize normalizer
    const normalizer = new DataNormalizer();
    const normalizedProducts = [];
    const results = {
      totalRows: rows.length,
      validRows: 0,
      invalidRows: 0,
      errors: [],
      warnings: [],
      isValid: true
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      try {
        const { normalized, errors, warnings } = normalizer.normalizeRow(
          row,
          columnMapping,
          rowNumber
        );

        // Collect errors and warnings
        results.errors.push(...errors);
        results.warnings.push(...warnings);

        if (normalized) {
          normalized.supplierId = supplierId;
          normalizedProducts.push(normalized);
          results.validRows++;
        } else {
          results.invalidRows++;
        }
      } catch (error) {
        results.errors.push({
          row: rowNumber,
          field: 'general',
          message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: row
        });
        results.invalidRows++;
      }
    }

    // Determine overall validity
    results.isValid = results.errors.length === 0;

    // Save normalized products to database
    let savedProducts = [];
    if (normalizedProducts.length > 0) {
      try {
        const productsToSave = normalizedProducts.map(product => ({
          supplierId: product.supplierId,
          brand: product.brand,
          productName: product.productName,
          variantSize: product.variantSize,
          ean: product.ean,
          wholesalePrice: parseFloat(product.wholesalePrice),
          currency: product.currency,
          packSize: product.packSize,
          supplierName: supplier.name,
          lastPurchasePrice: product.lastPurchasePrice ? parseFloat(product.lastPurchasePrice) : null,
          availability: product.availability,
          notes: product.notes,
          importSessionId: `import_${Date.now()}_${fileName}`
        }));

        savedProducts = await prisma.normalizedProduct.createMany({
          data: productsToSave,
          skipDuplicates: true
        });

        console.log(`Saved ${savedProducts.length} normalized products to database`);
      } catch (error) {
        console.error('Error saving products to database:', error);
        return NextResponse.json(
          { error: 'Failed to save products to database' },
          { status: 500 }
        );
      }
    }

    // Save column mapping template for future use
    try {
      const templateName = `${supplier.name} - ${fileName}`;
      
      // Check if template already exists
      const existingTemplate = await prisma.supplierMapping.findFirst({
        where: {
          supplierId,
          name: templateName
        }
      });

      if (existingTemplate) {
        // Update existing template
        await prisma.supplierMapping.update({
          where: { id: existingTemplate.id },
          data: {
            columnMappings: columnMapping,
            updatedAt: new Date()
          }
        });
      } else {
        // Create new template
        await prisma.supplierMapping.create({
          data: {
            supplierId,
            name: templateName,
            description: `Auto-generated from ${fileName}`,
            isDefault: false,
            columnMappings: columnMapping,
            dataCleaningRules: {}
          }
        });
      }

      console.log('Saved column mapping template');
    } catch (error) {
      console.error('Error saving column mapping template:', error);
      // Don't fail the import if template saving fails
    }

    return NextResponse.json({
      success: true,
      importId: `import_${Date.now()}`,
      totalRows: results.totalRows,
      validRows: results.validRows,
      invalidRows: results.invalidRows,
      errors: results.errors,
      warnings: results.warnings,
      normalizedProducts: normalizedProducts.slice(0, 5), // Return first 5 for preview
      savedCount: savedProducts.length
    });

  } catch (error) {
    console.error('Error in import endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request: NextRequest) {
  try {
    // Soft auth
    await auth().catch(() => null);

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');

    if (supplierId) {
      // Get saved mapping templates for a specific supplier
      const templates = await prisma.supplierMapping.findMany({
        where: { supplierId },
        orderBy: { updatedAt: 'desc' }
      });

      return NextResponse.json({
        success: true,
        templates
      });
    } else {
      // Get all suppliers with their mapping templates
      const suppliers = await prisma.supplier.findMany({
        include: {
          mappings: {
            orderBy: { updatedAt: 'desc' }
          }
        }
      });

      return NextResponse.json({
        success: true,
        suppliers
      });
    }

  } catch (error) {
    console.error('Error in import GET endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
