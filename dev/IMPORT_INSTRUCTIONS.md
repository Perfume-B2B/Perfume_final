# 📥 Product Bulk Import Guide

## 🎯 **What You Need to Do**

Your current Excel file only has a `Brand` column, but the system needs **7 required columns** to work properly.

## 📋 **Required Columns (Must Have)**

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| `name` | ✅ **YES** | Product name | "Fragrance World Perfume 1" |
| `brand` | ✅ **YES** | Brand name | "Fragrance World" |
| `content` | ✅ **YES** | Size/volume | "100ml" |
| `ean` | ✅ **YES** | 13-digit EAN code | "1234567890123" |
| `purchasePrice` | ✅ **YES** | Cost price | "25.50" |
| `retailPrice` | ✅ **YES** | Selling price | "45.00" |
| `stockQuantity` | ✅ **YES** | Available stock | "50" |

## 🔧 **Optional Columns (Nice to Have)**

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| `maxOrderableQuantity` | ❌ No | Max order limit | "100" |
| `starRating` | ❌ No | Rating 1-5 | "4" |
| `category` | ❌ No | Main category | "Perfume" |
| `subcategory` | ❌ No | Sub category | "Women" |
| `description` | ❌ No | Product description | "A luxurious fragrance..." |
| `tags` | ❌ No | Comma-separated tags | "vanilla,jasmine,luxury" |
| `status` | ❌ No | Product status | "ACTIEF" |

## 📁 **Template Files Available**

1. **`product-import-template.csv`** - Basic template with required columns
2. **`product-import-template-detailed.csv`** - Template with all columns
3. **`product-import-template-complete.csv`** - Complete template with sample data

## 🚀 **How to Use the Templates**

### **Step 1: Download the Template**
- Use any of the CSV template files above
- Open in Excel, Google Sheets, or any spreadsheet software

### **Step 2: Fill in Your Data**
- **Replace the sample data** with your actual product information
- **Keep the column headers exactly as shown** (case-sensitive)
- **Ensure EAN codes are exactly 13 digits** (no spaces or dashes)

### **Step 3: Save and Import**
- Save as CSV format
- Use the bulk import feature in your admin panel

## ⚠️ **Important Rules**

### **EAN Codes**
- Must be **exactly 13 digits**
- **Must be quoted as strings** in CSV (e.g., `"1234567890123"`)
- No spaces, dashes, or letters
- Must be unique for each product
- Example: `"1234567890123"` ✅
- Example: `1234567890123` ❌ (will be parsed as number)
- Example: `"123-456-789-0123"` ❌

### **Prices**
- Use **decimal format** (e.g., `25.50`)
- No currency symbols (€, $, £)
- No commas for thousands

### **Text Fields**
- Use **quotes** around text if it contains commas
- Example: `"vanilla,jasmine,luxury"`

## 🔍 **Example Data Row**

```csv
"Fragrance World Perfume 1","Fragrance World","100ml","1234567890123","25.50","45.00","50","100","4","Perfume","Women","A luxurious fragrance with notes of vanilla and jasmine","vanilla,jasmine,luxury","ACTIEF"
```

## ❌ **Common Mistakes to Avoid**

1. **Wrong column names** - Use exactly: `name`, `brand`, `content`, `ean`, etc.
2. **Missing EAN codes** - Every product needs a unique 13-digit EAN
3. **Invalid prices** - Use decimal format, no currency symbols
4. **Empty required fields** - All 7 required columns must have values
5. **Wrong file format** - Save as CSV, not Excel (.xlsx)

## 🆘 **Need Help?**

If you still get errors after using the template:
1. Check that all required columns are present
2. Verify EAN codes are 13 digits and unique
3. Ensure prices are in decimal format
4. Check the import logs for specific error messages

## 📊 **Your Current File Status**

- ✅ **Brand column found** (but needs to be lowercase `brand`)
- ❌ **Missing 6 required columns**
- ❌ **No EAN codes** (this is why import fails)

## 🎯 **Quick Fix**

1. **Download the template** from above
2. **Copy your brand data** from your current file
3. **Add the missing columns** (name, content, ean, prices, stock)
4. **Save as CSV** and import again

This will solve your bulk import issues! 🚀
