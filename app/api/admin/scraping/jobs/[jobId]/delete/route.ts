import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await auth().catch(() => null);
    const isDev = process.env.NODE_ENV !== 'production';
    
    if (!session || session.user.role !== 'ADMIN') {
      if (!isDev) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { jobId } = params;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Find the job
    const job = await prisma.priceScrapingJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Delete associated results first
    await prisma.priceScrapingResult.deleteMany({
      where: { jobId: jobId }
    });

    // Delete the job
    await prisma.priceScrapingJob.delete({
      where: { id: jobId }
    });

    console.log(`✅ Job ${jobId} deleted successfully`);

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting job:', error);
    return NextResponse.json(
      { error: 'Failed to delete job', details: error.message },
      { status: 500 }
    );
  }
}
