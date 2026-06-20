import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return NextResponse.json({
    keyLength: key.length,
    keyPrefix: key.slice(0, 20),
    keySuffix: key.slice(-8),
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}
