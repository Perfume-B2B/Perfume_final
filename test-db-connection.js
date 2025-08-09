const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Test if we can query (this will fail if tables don't exist, which is expected)
    try {
      const result = await prisma.$queryRaw`SELECT version()`;
      console.log('✅ Database query successful:', result);
    } catch (queryError) {
      console.log('ℹ️  Query failed (expected if tables don\'t exist):', queryError.message);
    }
    
    // Check for existing tables
    try {
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `;
      console.log('📋 Existing tables:', tables);
    } catch (tableError) {
      console.log('⚠️  Could not list tables:', tableError.message);
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('🔒 Database connection closed');
  }
}

testConnection();