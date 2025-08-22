import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/admin/reviews/[id]/approve
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
  const review = await prisma.review.update({
    where: { id },
    data: {
      status: "APPROVED",
      moderatedBy: session.user.id,
      moderatedAt: new Date(),
      rejectionReason: null,
    },
  });
  return NextResponse.json({ message: "Review approved", review });
  } catch (error) {
    console.error("Error approving review:", error);
    return NextResponse.json({ error: "Failed to approve review" }, { status: 500 });
  }
}
