import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    console.log("🔍 Debug endpoint called");
    
    // Test auth
    const session = await auth();
    console.log("🔐 Auth test:", session ? "Working" : "Failed");
    
    // Test environment variables
    const hasDbUrl = !!process.env.DATABASE_URL;
    const hasDirectUrl = !!process.env.DIRECT_URL;
    console.log("🌍 Environment:", { hasDbUrl, hasDirectUrl });
    
    // Test imports
    let testsResults = {
      auth: !!session,
      env_db: hasDbUrl,
      env_direct: hasDirectUrl,
      xlsx: false,
      decimal: false,
      prisma: false
    };
    
    try {
      const XLSX = require('xlsx');
      testsResults.xlsx = true;
      console.log("✅ XLSX import successful");
    } catch (e) {
      console.log("❌ XLSX import failed:", e);
    }
    
    try {
      const { Decimal } = require('decimal.js');
      testsResults.decimal = true;
      console.log("✅ Decimal.js import successful");
    } catch (e) {
      console.log("❌ Decimal.js import failed:", e);
    }
    
    try {
      const { prisma } = require('@/lib/prisma');
      testsResults.prisma = true;
      console.log("✅ Prisma import successful");
    } catch (e) {
      console.log("❌ Prisma import failed:", e);
    }
    
    return NextResponse.json({
      status: "Debug endpoint working",
      tests: testsResults,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasDbUrl,
        hasDirectUrl
      }
    });
    
  } catch (error) {
    console.error("💥 Debug endpoint error:", error);
    return NextResponse.json({
      error: "Debug failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 Debug POST endpoint called");
    
    // Test auth
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.log("🔐 Auth successful");
    
    // Test file upload
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    
    console.log("📁 File received:", {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    // Test file reading
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    console.log("📊 File buffer:", {
      bufferLength: buffer.length,
      firstBytes: buffer.slice(0, 100).toString('utf-8')
    });
    
    // Test XLSX parsing
    try {
      const XLSX = require('xlsx');
      const workbook = XLSX.read(buffer, { type: "buffer" });
      console.log("📊 XLSX workbook:", {
        sheets: workbook.SheetNames,
        sheetCount: workbook.SheetNames.length
      });
      
      if (workbook.SheetNames.length > 0) {
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet);
        console.log("📊 Parsed rows:", {
          count: rows.length,
          firstRow: rows[0]
        });
      }
      
    } catch (xlsxError) {
      console.error("❌ XLSX parsing failed:", xlsxError);
      return NextResponse.json({
        error: "XLSX parsing failed",
        details: xlsxError instanceof Error ? xlsxError.message : "Unknown XLSX error"
      }, { status: 400 });
    }
    
    return NextResponse.json({
      status: "File processing test successful",
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        bufferLength: buffer.length
      }
    });
    
  } catch (error) {
    console.error("💥 Debug POST error:", error);
    return NextResponse.json({
      error: "Debug POST failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
