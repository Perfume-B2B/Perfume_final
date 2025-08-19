import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Setting up scraping data...');

  try {
    // 1. Create a supplier (or use existing)
    console.log('📦 Checking for existing supplier...');
    let supplier = await prisma.supplier.findFirst({
      where: { name: 'Demo Fragrance Supplier' }
    });
    
    if (!supplier) {
      console.log('📦 Creating supplier...');
      supplier = await prisma.supplier.create({
        data: {
          name: 'Demo Fragrance Supplier',
          country: 'NL',
          currency: 'EUR',
          email: 'demo@fragrancesupplier.com',
          website: 'https://demo.fragrancesupplier.com',
          isActive: true,
          notes: 'Demo supplier for testing price scanning'
        }
      });
      console.log(`✅ Created supplier: ${supplier.name} (${supplier.id})`);
    } else {
      console.log(`✅ Using existing supplier: ${supplier.name} (${supplier.id})`);
    }

    // 2. Create normalized products (or use existing)
    console.log('📋 Checking for existing normalized products...');
    let existingProducts = await prisma.normalizedProduct.findMany({
      where: { supplierId: supplier.id }
    });

    if (existingProducts.length === 0) {
      console.log('📋 Creating normalized products...');
      const normalizedProducts = await prisma.normalizedProduct.createMany({
        data: [
          {
            supplierId: supplier.id,
            brand: 'Chanel',
            productName: 'Bleu de Chanel Eau de Parfum',
            variantSize: '100ml',
            ean: '3145891074604',
            wholesalePrice: 45.00,
            currency: 'EUR',
            packSize: 1,
            supplierName: supplier.name,
            lastPurchasePrice: 42.00,
            availability: true,
            notes: 'Popular men\'s fragrance'
          },
          {
            supplierId: supplier.id,
            brand: 'Dior',
            productName: 'Sauvage Eau de Toilette',
            variantSize: '100ml',
            ean: '3348901486383',
            wholesalePrice: 38.00,
            currency: 'EUR',
            packSize: 1,
            supplierName: supplier.name,
            lastPurchasePrice: 35.00,
            availability: true,
            notes: 'Fresh and modern men\'s fragrance'
          },
          {
            supplierId: supplier.id,
            brand: 'Hermès',
            productName: 'Terre d\'Hermès',
            variantSize: '100ml',
            ean: '3346131400014',
            wholesalePrice: 39.00,
            currency: 'EUR',
            packSize: 1,
            supplierName: supplier.name,
            lastPurchasePrice: 36.00,
            availability: true,
            notes: 'Earthy and sophisticated fragrance'
          }
        ]
      });
      console.log(`✅ Created ${normalizedProducts.count} normalized products`);
      existingProducts = await prisma.normalizedProduct.findMany({
        where: { supplierId: supplier.id }
      });
    } else {
      console.log(`✅ Found ${existingProducts.length} existing normalized products`);
    }

    // 3. Check for existing scraping sources
    console.log('🌐 Checking for existing scraping sources...');
    let sources = await prisma.priceScrapingSource.findMany({
      where: { isActive: true }
    });

    if (sources.length === 0) {
      console.log('🌐 Creating scraping sources...');
      sources = await Promise.all([
        prisma.priceScrapingSource.create({
          data: {
            name: 'Amazon NL Demo',
            baseUrl: 'https://www.amazon.nl',
            country: 'NL',
            isActive: true,
            priority: 1,
            rateLimit: 100,
            config: {
              useHeadless: true,
              delay: 2000,
              selectors: {
                searchInput: 'input[name="field-keywords"]',
                searchButton: 'input[type="submit"]',
                productTitle: 'h2 a.a-link-normal',
                price: '.a-price-whole',
                availability: '.a-color-success'
              }
            }
          }
        }),
        prisma.priceScrapingSource.create({
          data: {
            name: 'Bol.com Demo',
            baseUrl: 'https://www.bol.com',
            country: 'NL',
            isActive: true,
            priority: 2,
            rateLimit: 100,
            config: {
              useHeadless: true,
              delay: 1500,
              selectors: {
                searchInput: 'input[name="search"]',
                searchButton: 'button[type="submit"]',
                productTitle: 'h3[data-test="title"]',
                price: '[data-test="price"]',
                availability: '[data-test="availability"]'
              }
            }
          }
        }),
        prisma.priceScrapingSource.create({
          data: {
            name: 'Douglas Demo',
            baseUrl: 'https://www.douglas.nl',
            country: 'NL',
            isActive: true,
            priority: 3,
            rateLimit: 80,
            config: {
              useHeadless: true,
              delay: 2500,
              selectors: {
                searchInput: 'input[name="q"]',
                searchButton: 'button[type="submit"]',
                productTitle: '.product-name',
                price: '.price',
                availability: '.availability'
              }
            }
          }
        })
      ]);
      console.log(`✅ Created ${sources.length} scraping sources`);
    } else {
      console.log(`✅ Found ${sources.length} existing active scraping sources`);
    }

    // 4. Check for existing scraping jobs
    console.log('📊 Checking for existing scraping jobs...');
    let existingJobs = await prisma.priceScrapingJob.findMany({
      where: { supplierId: supplier.id }
    });

    if (existingJobs.length === 0) {
      console.log('📊 Creating sample scraping job...');
      const job = await prisma.priceScrapingJob.create({
        data: {
          name: 'Demo Price Scan',
          description: 'Sample job for testing',
          status: 'COMPLETED',
          supplierId: supplier.id,
          totalProducts: existingProducts.length,
          processedProducts: existingProducts.length,
          successfulProducts: Math.floor(existingProducts.length * 0.7),
          failedProducts: Math.ceil(existingProducts.length * 0.3),
          config: {
            sources: sources.map(s => s.id),
            priority: 'NORMAL',
            batchSize: 10,
            delayBetweenBatches: 5000,
            maxRetries: 3,
            confidenceThreshold: 0.7
          }
        }
      });
      console.log(`✅ Created sample job: ${job.name} (${job.id})`);
      existingJobs = [job];
    } else {
      console.log(`✅ Found ${existingJobs.length} existing scraping jobs`);
    }

    // 5. Check for existing price results
    console.log('💰 Checking for existing price results...');
    let existingResults = await prisma.priceScrapingResult.findMany({
      where: { 
        normalizedProduct: { supplierId: supplier.id }
      }
    });

    if (existingResults.length === 0 && existingProducts.length > 0) {
      console.log('💰 Creating sample price results...');
      const products = existingProducts.slice(0, 2);
      
      const priceResults = await Promise.all([
        prisma.priceScrapingResult.create({
          data: {
            normalizedProductId: products[0].id,
            sourceId: sources[0].id,
            productTitle: products[0].productName,
            merchant: 'Amazon NL',
            url: 'https://www.amazon.nl/demo-product-1',
            price: 79.95,
            priceInclVat: true,
            shippingCost: 4.99,
            availability: true,
            confidenceScore: 0.85,
            isLowestPrice: true,
            jobId: existingJobs[0].id
          }
        }),
        prisma.priceScrapingResult.create({
          data: {
            normalizedProductId: products[0].id,
            sourceId: sources[1].id,
            productTitle: products[0].productName,
            merchant: 'Bol.com',
            url: 'https://www.bol.com/demo-product-1',
            price: 82.50,
            priceInclVat: true,
            shippingCost: 3.99,
            availability: true,
            confidenceScore: 0.80,
            isLowestPrice: false,
            jobId: existingJobs[0].id
          }
        }),
        prisma.priceScrapingResult.create({
          data: {
            normalizedProductId: products[1].id,
            sourceId: sources[0].id,
            productTitle: products[1].productName,
            merchant: 'Amazon NL',
            url: 'https://www.amazon.nl/demo-product-2',
            price: 84.95,
            priceInclVat: true,
            shippingCost: 4.99,
            availability: true,
            confidenceScore: 0.90,
            isLowestPrice: true,
            jobId: existingJobs[0].id
          }
        })
      ]);
      console.log(`✅ Created ${priceResults.length} sample price results`);
      existingResults = priceResults;
    } else {
      console.log(`✅ Found ${existingResults.length} existing price results`);
    }

    console.log('🎉 Scraping data setup completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Supplier: ${supplier.name}`);
    console.log(`   - Normalized Products: ${existingProducts.length}`);
    console.log(`   - Scraping Sources: ${sources.length}`);
    console.log(`   - Scraping Jobs: ${existingJobs.length}`);
    console.log(`   - Price Results: ${existingResults.length}`);

  } catch (error) {
    console.error('❌ Error setting up scraping data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
