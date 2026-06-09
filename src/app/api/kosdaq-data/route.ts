import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

// 허용된 파일명만 접근 가능
const ALLOWED_FILES = new Set([
  "kosdaq-anomaly-report", "kosdaq-name-changes", "kosdaq-major-holder-changes",
  "kosdaq-lawsuits", "kosdaq-cb-issuances", "kosdaq-high-volatility",
  "kosdaq-purpose-additions",
  "dart-nameChanges-12m", "dart-majorHolderChanges-12m", "dart-purposeAdditions-12m", "dart-lawsuits-12m",
  "daily-report",
]);

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file") || "kosdaq-anomaly-report";

  // 경로 탐색 방지
  if (!ALLOWED_FILES.has(file) || file.includes("..") || file.includes("/")) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  try {
    const filePath = path.join(DATA_DIR, `${file}.json`);
    const raw = fs.readFileSync(filePath, "utf-8");
    return new NextResponse(raw, { headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "Read error" }, { status: 500 });
  }
}
