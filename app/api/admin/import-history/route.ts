import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getImportHistory, getImportHistoryById } from "@/lib/import/importHistory";

export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") as "completed" | "failed" | "cancelled" | undefined;
    const id = searchParams.get("id");

    // If ID is provided, return specific import
    if (id) {
      const importEntry = await getImportHistoryById(id);
      if (!importEntry) {
        return NextResponse.json({ error: "Import not found" }, { status: 404 });
      }
      return NextResponse.json(importEntry);
    }

    // Return paginated list
    const result = await getImportHistory(page, limit, status);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching import history:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
