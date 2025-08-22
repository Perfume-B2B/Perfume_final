# 🚀 Scraper Fix Verification Guide

## ✅ **FIXES APPLIED:**

1. **Fixed API Route** (`app/api/admin/scraping/price-scan/route.ts`):
   - Ensured `sources` array is properly passed to ScrapingManager
   - Added explicit source configuration to job config

2. **Added Debugging** (`lib/scraping/ScrapingManager.ts`):
   - Added logging to see what sources are being processed
   - Added logging to see available scrapers

## 🔍 **How to Test:**

### **Step 1: Start a New Price Scan**
1. Go to `/admin/scraping/price-scan`
2. Select a supplier
3. **Make sure sources are selected** (checkboxes should be checked)
4. Click "Start Price Scanning"

### **Step 2: Check Browser Console**
Look for these debug messages:
```
Starting scraping job: Price Scan - Supplier [name]
Total products to process: [number]
Job config sources: ["source-id-1", "source-id-2", ...]
Available scrapers: ["source-id-1", "source-id-2", ...]
Processing batch with [X] products and [Y] sources: ["source-id-1", "source-id-2", ...]
Active scrapers after filtering: [Z] ["source-id-1", "source-id-2", ...]
```

### **Step 3: Expected Behavior**
- **Before Fix**: `Job config sources: []` (empty array)
- **After Fix**: `Job config sources: ["pure-oud", "amazon-nl", ...]` (actual source IDs)

## 🚨 **If Still Not Working:**

### **Check 1: Database Configuration**
```sql
-- Verify sources have correct selectors
SELECT id, name, "isActive", config->'selectors' as selectors 
FROM price_scraping_sources 
WHERE "isActive" = true;
```

### **Check 2: Job Configuration**
```sql
-- Check if job has sources in config
SELECT id, name, config->'sources' as sources 
FROM price_scraping_jobs 
ORDER BY "createdAt" DESC 
LIMIT 1;
```

### **Check 3: Frontend Selection**
- Ensure checkboxes are actually checked
- Check browser network tab for request payload
- Verify `selectedSources` state in React component

## 🎯 **Success Indicators:**

1. **Console shows actual source IDs** instead of empty array
2. **Scrapers are properly filtered** by selected sources
3. **Real scraping happens** instead of demo data
4. **Products are found** on actual websites
5. **Results show real prices** from e-commerce sites

## 🔧 **If Issues Persist:**

The problem might be:
1. **Frontend not sending sources** (check React state)
2. **Database selectors still wrong** (run SQL fix again)
3. **Scraper implementations broken** (check individual scrapers)
4. **Rate limiting/blocking** (check if sites block scrapers)
