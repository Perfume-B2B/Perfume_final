import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getSecurityEvents,
  getSecurityAlerts,
  getSecurityStats,
  resolveSecurityAlert,
} from "@/lib/security-monitoring";

export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "events":
        const limit = parseInt(searchParams.get("limit") || "100");
        const type = searchParams.get("type") as
          | "auth_failure"
          | "rate_limit"
          | "csrf_violation"
          | "validation_error"
          | "suspicious_activity"
          | undefined;
        const events = getSecurityEvents(limit, type);
        return NextResponse.json({ events });

      case "alerts":
        const resolved = searchParams.get("resolved");
        const alerts = getSecurityAlerts(resolved ? resolved === "true" : undefined);
        return NextResponse.json({ alerts });

      case "stats":
        const stats = getSecurityStats();
        return NextResponse.json({ stats });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Security monitoring API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { action, alertId, resolvedBy } = body;

    switch (action) {
      case "resolve_alert":
        if (!alertId || !resolvedBy) {
          return NextResponse.json({ error: "Missing alertId or resolvedBy" }, { status: 400 });
        }

        const success = resolveSecurityAlert(alertId, resolvedBy);
        if (!success) {
          return NextResponse.json({ error: "Alert not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Security monitoring API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
