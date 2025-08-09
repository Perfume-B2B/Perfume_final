import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { operation, secret } = await request.json();
    
    // Simple security check - you should use a proper secret
    if (secret !== process.env.NEXTAUTH_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let result;
    
    switch (operation) {
      case 'db-push':
        console.log('Running Prisma DB push...');
        result = await execAsync('npx prisma db push --accept-data-loss');
        break;
        
      case 'db-seed':
        console.log('Running Prisma DB seed...');
        result = await execAsync('npx prisma db seed');
        break;
        
      case 'generate':
        console.log('Running Prisma generate...');
        result = await execAsync('npx prisma generate');
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      operation,
      stdout: result.stdout,
      stderr: result.stderr 
    });

  } catch (error: any) {
    console.error('Database operation error:', error);
    return NextResponse.json({ 
      error: 'Database operation failed',
      details: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    }, { status: 500 });
  }
}