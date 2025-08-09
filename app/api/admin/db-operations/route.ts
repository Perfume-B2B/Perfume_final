import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const operation = url.searchParams.get('operation');
    const key = url.searchParams.get('key');
    
    // Simple security check using query parameter
    if (key !== 'db-setup-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let result;
    
    switch (operation) {
      case 'test-connection':
        console.log('Testing database connection...');
        await prisma.$connect();
        result = { message: 'Database connection successful' };
        break;
        
      case 'create-tables':
        console.log('Creating database tables...');
        // Instead of running prisma db push, we'll create the essential tables manually
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "users" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "username" TEXT NOT NULL UNIQUE,
            "password" TEXT,
            "role" TEXT NOT NULL DEFAULT 'BUYER',
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "customerId" TEXT,
            "clientRoleId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `;
        
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "products" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "price" DECIMAL(10,2) NOT NULL,
            "category" TEXT,
            "brand" TEXT,
            "imageUrl" TEXT,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `;
        
        result = { message: 'Essential tables created successfully' };
        break;
        
      case 'seed-admin':
        console.log('Creating admin user...');
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await prisma.user.upsert({
          where: { username: 'admin' },
          update: {},
          create: {
            id: 'admin-user-1',
            username: 'admin',
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true
          }
        });
        
        result = { message: 'Admin user created successfully' };
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid operation. Use: test-connection, create-tables, or seed-admin' }, { status: 400 });
    }

    await prisma.$disconnect();

    return NextResponse.json({ 
      success: true, 
      operation,
      result
    });

  } catch (error: any) {
    console.error('Database operation error:', error);
    await prisma.$disconnect();
    
    return NextResponse.json({ 
      error: 'Database operation failed',
      details: error.message
    }, { status: 500 });
  }
}