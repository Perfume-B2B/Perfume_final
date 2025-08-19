import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "pos.receipt";

const receiptSettingsSchema = z.object({
  header: z.string().max(2000).default("Project X Store\\n123 Example St\\nCity, NL"),
  footer: z.string().max(2000).default("Thank you for your purchase!\\nwww.example.com"),
  notes: z.string().max(2000).optional().default(""),
  autoPrint: z.boolean().default(true),
  includeDescriptions: z.boolean().default(true),
  includeQr: z.boolean().default(false),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const setting = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    if (!setting) {
      // Return defaults if not set yet
      const defaults = receiptSettingsSchema.parse({});
      return NextResponse.json(defaults);
    }
    // Validate stored value against schema to be safe
    const parsed = receiptSettingsSchema.parse(setting.value);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("GET /api/admin/settings/pos/receipt failed", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = receiptSettingsSchema.parse(body);

    await prisma.appSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: validated },
      create: { key: SETTINGS_KEY, value: validated },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/admin/settings/pos/receipt failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}


