const XLSX = require('xlsx');
const path = require('path');

// Path to your Excel file
const filePath = 'C:\\Users\\Aqsak\\Downloads\\Ordersheet_2025-08-07.xlsx';

try {
  console.log('🔍 Analyzing Excel file:', filePath);
  
  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  
  // Get sheet names
  console.log('\n📊 Sheet names:', workbook.SheetNames);
  
  // Get the first sheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const rows = XLSX.utils.sheet_to_json(worksheet);
  
  console.log('\n📈 Total rows:', rows.length);
  
  if (rows.length > 0) {
    // Get column names from first row
    const columns = Object.keys(rows[0]);
    console.log('\n📋 Available columns:', columns);
    
    // Check for required columns
    const requiredColumns = ['name', 'brand', 'content', 'ean', 'purchasePrice', 'retailPrice', 'stockQuantity'];
    const missingColumns = requiredColumns.filter(col => !columns.includes(col));
    const foundColumns = requiredColumns.filter(col => columns.includes(col));
    
    console.log('\n✅ Found required columns:', foundColumns);
    console.log('❌ Missing required columns:', missingColumns);
    
    // Show first row sample
    console.log('\n🔍 First row sample:');
    console.log(JSON.stringify(rows[0], null, 2));
    
    // Check for similar column names (case-insensitive)
    console.log('\n🔍 Looking for similar column names:');
    requiredColumns.forEach(required => {
      const similar = columns.filter(col => 
        col.toLowerCase().includes(required.toLowerCase()) ||
        required.toLowerCase().includes(col.toLowerCase())
      );
      if (similar.length > 0) {
        console.log(`  ${required} → Found similar: ${similar.join(', ')}`);
      }
    });
    
    // Check for EAN-like columns
    const eanLikeColumns = columns.filter(col => 
      col.toLowerCase().includes('ean') ||
      col.toLowerCase().includes('barcode') ||
      col.toLowerCase().includes('code') ||
      col.toLowerCase().includes('sku')
    );
    console.log('\n🏷️  EAN-like columns found:', eanLikeColumns);
    
  } else {
    console.log('❌ No data found in the file');
  }
  
} catch (error) {
  console.error('❌ Error reading file:', error.message);
  console.log('\n💡 Make sure:');
  console.log('  1. The file path is correct');
  console.log('  2. The file is not open in Excel');
  console.log('  3. You have read permissions for the file');
}
