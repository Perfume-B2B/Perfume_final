import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { CurrencyConverter } from '@/lib/scraping/currency/CurrencyConverter';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fromCurrency = searchParams.get('from');
    const toCurrency = searchParams.get('to');
    const date = searchParams.get('date');

    if (fromCurrency && toCurrency) {
      // Get specific exchange rate
      const converter = new CurrencyConverter();
      const rate = await converter.getExchangeRate(fromCurrency, toCurrency, date ? new Date(date) : undefined);
      
      return NextResponse.json({
        success: true,
        fromCurrency,
        toCurrency,
        rate,
        date: date || 'latest'
      });
    } else {
      // Get all currency rates
      const rates = await prisma.currencyRate.findMany({
        where: { isActive: true },
        orderBy: [
          { fromCurrency: 'asc' },
          { toCurrency: 'asc' },
          { date: 'desc' }
        ],
        take: 100
      });

      return NextResponse.json({
        success: true,
        rates: rates.map(rate => ({
          id: rate.id,
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
          rate: parseFloat(rate.rate.toString()),
          date: rate.date,
          source: rate.source,
          isActive: rate.isActive
        }))
      });
    }

  } catch (error) {
    console.error('Error in currency endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, fromCurrency, toCurrency, rate, date } = body;

    if (action === 'update-rates') {
      // Update exchange rates from external API
      const converter = new CurrencyConverter();
      await converter.updateExchangeRates();
      
      return NextResponse.json({
        success: true,
        message: 'Exchange rates updated successfully'
      });
    } else if (action === 'add-rate') {
      // Manually add a currency rate
      if (!fromCurrency || !toCurrency || !rate) {
        return NextResponse.json(
          { error: 'Missing required fields: fromCurrency, toCurrency, rate' },
          { status: 400 }
        );
      }

      const targetDate = date ? new Date(date) : new Date();
      targetDate.setHours(0, 0, 0, 0);

      // Check if rate already exists for the date
      const existingRate = await prisma.currencyRate.findFirst({
        where: {
          fromCurrency,
          toCurrency,
          date: targetDate
        }
      });

      let savedRate;
      if (existingRate) {
        // Update existing rate
        savedRate = await prisma.currencyRate.update({
          where: { id: existingRate.id },
          data: {
            rate: parseFloat(rate),
            updatedAt: new Date()
          }
        });
      } else {
        // Create new rate
        savedRate = await prisma.currencyRate.create({
          data: {
            fromCurrency,
            toCurrency,
            rate: parseFloat(rate),
            date: targetDate,
            source: 'Manual',
            isActive: true
          }
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Currency rate saved successfully',
        rate: {
          id: savedRate.id,
          fromCurrency: savedRate.fromCurrency,
          toCurrency: savedRate.toCurrency,
          rate: parseFloat(savedRate.rate.toString()),
          date: savedRate.date,
          source: savedRate.source
        }
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "update-rates" or "add-rate"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in currency POST endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rateId, isActive } = body;

    if (!rateId) {
      return NextResponse.json(
        { error: 'Missing rateId' },
        { status: 400 }
      );
    }

    // Update rate status
    const updatedRate = await prisma.currencyRate.update({
      where: { id: rateId },
      data: {
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Currency rate updated successfully',
      rate: {
        id: updatedRate.id,
        fromCurrency: updatedRate.fromCurrency,
        toCurrency: updatedRate.toCurrency,
        rate: parseFloat(updatedRate.rate.toString()),
        date: updatedRate.date,
        source: updatedRate.source,
        isActive: updatedRate.isActive
      }
    });

  } catch (error) {
    console.error('Error in currency PUT endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rateId = searchParams.get('id');

    if (!rateId) {
      return NextResponse.json(
        { error: 'Missing rate ID' },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    await prisma.currencyRate.update({
      where: { id: rateId },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Currency rate deleted successfully'
    });

  } catch (error) {
    console.error('Error in currency DELETE endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
