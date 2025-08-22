import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
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

    // Check if job can be stopped
    if (job.status !== 'RUNNING' && job.status !== 'PENDING') {
      return NextResponse.json({ 
        error: `Cannot stop job with status: ${job.status}` 
      }, { status: 400 });
    }

    // Update job status to stopped
    const updatedJob = await prisma.priceScrapingJob.update({
      where: { id: jobId },
      data: {
        status: 'STOPPED',
        completedAt: new Date(),
        errorMessage: 'Job stopped by user'
      }
    });

    console.log(`✅ Job ${jobId} stopped successfully`);

    return NextResponse.json({
      success: true,
      message: 'Job stopped successfully',
      job: updatedJob
    });

  } catch (error: any) {
    console.error('Error stopping job:', error);
    return NextResponse.json(
      { error: 'Failed to stop job', details: error.message },
      { status: 500 }
    );
  }
}
