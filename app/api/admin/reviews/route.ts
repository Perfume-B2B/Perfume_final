import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/admin/reviews?status=&rating=&productId=&customerId=&search=
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const rating = searchParams.get("rating");
  const productId = searchParams.get("productId");
  const customerId = searchParams.get("customerId");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (rating) where.rating = Number(rating);
  if (productId) where.productId = productId;
  if (customerId) where.customerId = customerId;
  if (search) {
    where.OR = [
      { comment: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { product: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const reviews = await prisma.review.findMany({
    where,
    include: {
      customer: { select: { name: true, email: true } },
      product: { select: { name: true } },
      moderator: { select: { username: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ reviews });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}
