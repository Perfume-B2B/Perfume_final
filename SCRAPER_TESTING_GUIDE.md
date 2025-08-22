# 🚀 Scraper Testing Guide

## 📋 Overview
This guide explains how to test the scraping module using the provided dummy CSV file and understanding the complete flow.

## 📁 Test Files Created
- `test_scraping_products.csv` - 15 perfume products for testing
- `SCRAPER_TESTING_GUIDE.md` - This testing guide

## 🔄 Complete Scraper Flow

### 1. **Data Import Flow**
```
CSV Upload → Column Mapping → Data Normalization → Database Storage → Scraping Job Creation
```

### 2. **Scraping Execution Flow**
```
Job Initiation → Scraper Initialization → Browser Launch → Product Processing → Data Extraction → Result Matching → Database Storage
```

### 3. **Data Processing Flow**
```
Raw CSV → Normalized Products → Search Terms → Web Scraping → Price Results → AI Matching → Final Results
```

## 📊 CSV Structure & Column Mapping

### **Required Columns (Mandatory)**
- `Brand` → Maps to `brand` field
- `Product Name` → Maps to `productName` field  
- `Wholesale Price` → Maps to `wholesalePrice` field

### **Optional Columns**
- `Variant Size` → Maps to `variantSize` field
- `EAN` → Maps to `ean` field (for exact matching)
- `Currency` → Maps to `currency` field (defaults to EUR)
- `Pack Size` → Maps to `packSize` field (defaults to 1)
- `Supplier` → Maps to `supplierName` field
- `Last Purchase Price` → Maps to `lastPurchasePrice` field
- `Availability` → Maps to `availability` field (defaults to true)
- `Notes` → Maps to `notes` field

## 🧪 Testing Steps

### **Step 1: Prepare Test Environment**
1. Ensure you have admin access to the system
2. Have the `test_scraping_products.csv` file ready
3. Make sure scraping sources are configured (Amazon NL, Bol.com, etc.)

### **Step 2: Import CSV Data**
1. Navigate to `/admin/scraping/import`
2. Upload the CSV file
3. Map columns correctly:
   ```typescript
   const columnMapping = {
     brand: 'Brand',
     productName: 'Product Name',
     variantSize: 'Variant Size',
     ean: 'EAN',
     wholesalePrice: 'Wholesale Price',
     currency: 'Currency',
     packSize: 'Pack Size',
     supplier: 'Supplier',
     lastPurchasePrice: 'Last Purchase Price',
     availability: 'Availability',
     notes: 'Notes'
   };
   ```

### **Step 3: Verify Data Normalization**
The system will:
- Clean and validate all data
- Convert prices to Decimal format
- Normalize sizes (e.g., "100 ml" → "100ml")
- Validate EAN codes
- Parse availability status

### **Step 4: Create Scraping Job**
1. Select supplier for the imported products
2. Choose scraping sources (Amazon NL, Bol.com, etc.)
3. Configure job parameters:
   - Batch size: 10 (default)
   - Delay between batches: 5000ms
   - Max retries: 3
   - Confidence threshold: 0.7

### **Step 5: Monitor Scraping Progress**
Watch the job status:
- `PENDING` → Job created, waiting to start
- `RUNNING` → Actively scraping products
- `COMPLETED` → All products processed
- `FAILED` → Error occurred during scraping

## 🔍 Expected Scraping Behavior

### **For Each Product:**
1. **Search Term Generation**: `"Chanel Bleu de Chanel Eau de Parfum 100ml"`
2. **Multi-Source Scraping**: Search on Amazon NL, Bol.com, etc.
3. **Data Extraction**: Title, price, availability, shipping cost
4. **Product Matching**: AI-powered matching using EAN, brand, size
5. **Result Storage**: Top 3 matches per product saved to database

### **Scraping Sources Available:**
- **Amazon NL**: Priority 1, Rate limit: 100 req/hour
- **Bol.com**: Priority 2, Rate limit: 100 req/hour  
- **House of Niche**: Priority 3, Rate limit: 80 req/hour

## 📈 Expected Results

### **Data Quality Metrics:**
- **Total Products**: 15
- **Expected Success Rate**: 70-90% (depending on source availability)
- **Processing Time**: ~2-5 minutes for 15 products
- **Results per Product**: 1-3 price results from different sources

### **Sample Expected Output:**
```json
{
  "success": true,
  "jobId": "job_123456",
  "totalProducts": 15,
  "processedProducts": 15,
  "successfulProducts": 12,
  "failedProducts": 3,
  "status": "COMPLETED"
}
```

## 🚨 Common Issues & Solutions

### **Issue 1: Column Mapping Errors**
- **Problem**: Required columns not found
- **Solution**: Ensure CSV has correct column headers
- **Check**: Brand, Product Name, Wholesale Price are present

### **Issue 2: Data Validation Failures**
- **Problem**: Invalid price formats or EAN codes
- **Solution**: Check data quality in CSV
- **Check**: Prices are numeric, EANs are 8-14 digits

### **Issue 3: Scraping Failures**
- **Problem**: Anti-bot protection or rate limiting
- **Solution**: Check scraper health status
- **Check**: Increase delays between requests

### **Issue 4: No Results Found**
- **Problem**: Products not found on e-commerce sites
- **Solution**: Verify search terms are accurate
- **Check**: Brand names and product names match exactly

## 🔧 Testing Configuration

### **Scraper Settings:**
```typescript
// BaseScraper configuration
const launchArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas'
];

// Rate limiting
const delay = 2000; // 2 seconds between requests
const batchDelay = 5000; // 5 seconds between batches
```

### **Matching Algorithm:**
```typescript
const matchingConfig = {
  eanWeight: 1.0,        // EAN matching (highest priority)
  brandSizeWeight: 0.9,  // Brand + Size matching
  fuzzyTitleWeight: 0.7, // Fuzzy title matching
  confidenceThreshold: 0.3 // Minimum score for consideration
};
```

## 📊 Performance Expectations

### **Processing Speed:**
- **Small Batch (10 products)**: 2-3 minutes
- **Medium Batch (50 products)**: 8-12 minutes
- **Large Batch (100+ products)**: 20-30 minutes

### **Resource Usage:**
- **Memory**: ~200-500MB per scraper instance
- **CPU**: Moderate during active scraping
- **Network**: Varies based on source response times

### **Success Rates by Source:**
- **Amazon NL**: 80-90% (high availability)
- **Bol.com**: 70-85% (good availability)
- **House of Niche**: 60-75% (niche products)

## 🎯 Testing Scenarios

### **Scenario 1: Basic Import & Scraping**
1. Upload CSV with 15 products
2. Run scraping job on all sources
3. Verify results in database

### **Scenario 2: Partial Source Scraping**
1. Upload CSV with 15 products
2. Run scraping job on specific sources only
3. Compare results with full scraping

### **Scenario 3: Error Handling**
1. Upload CSV with invalid data
2. Verify error messages and validation
3. Check partial import success

### **Scenario 4: Performance Testing**
1. Upload CSV with 50+ products
2. Monitor processing time and resource usage
3. Verify batch processing efficiency

## 🔍 Monitoring & Debugging

### **Log Locations:**
- **Console Logs**: Real-time scraping progress
- **Database**: `price_scraping_jobs` and `price_scraping_results` tables
- **API Responses**: Job status and progress updates

### **Key Metrics to Monitor:**
- Job status changes
- Products processed vs. successful
- Scraping source health
- Error rates and types
- Processing time per batch

### **Debug Commands:**
```typescript
// Check scraper health
const health = await manager.getScraperHealth();

// Get current job status
const currentJob = manager.getCurrentJob();

// Check available scrapers
const scrapers = manager.getAvailableScrapers();
```

## ✅ Success Criteria

### **Import Success:**
- ✅ All 15 products imported successfully
- ✅ Data normalized correctly
- ✅ No validation errors

### **Scraping Success:**
- ✅ Job completes without errors
- ✅ At least 70% of products return results
- ✅ Results stored in database correctly
- ✅ Price data is accurate and recent

### **Performance Success:**
- ✅ Processing time under 10 minutes for 15 products
- ✅ No memory leaks or resource issues
- ✅ Rate limiting respected
- ✅ Anti-bot protection avoided

## 🚀 Next Steps After Testing

1. **Analyze Results**: Review scraped prices and margins
2. **Optimize Configuration**: Adjust delays and batch sizes
3. **Add New Sources**: Implement additional e-commerce sites
4. **Scale Up**: Test with larger product catalogs
5. **Automate**: Set up scheduled scraping jobs

---

**Happy Testing! 🎉**

For any issues or questions, check the console logs and database tables for detailed error information.
