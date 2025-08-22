import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const rejectSchema = z.object({ reason: z.string().min(3).max(255) });

// POST /api/admin/reviews/[id]/reject
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
  const body = await request.json();
  let parsed;
  try {
    parsed = rejectSchema.parse(body);
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
  }
  const review = await prisma.review.update({
    where: { id },
    data: {
      status: "REJECTED",
      moderatedBy: session.user.id,
      moderatedAt: new Date(),
      rejectionReason: parsed.reason,
    },
  });
  return NextResponse.json({ message: "Review rejected", review });
  } catch (error) {
    console.error("Error rejecting review:", error);
    return NextResponse.json({ error: "Failed to reject review" }, { status: 500 });
  }
}
