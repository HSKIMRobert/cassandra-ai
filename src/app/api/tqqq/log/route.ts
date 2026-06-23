import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TqqqLog" (
      "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "date"      TEXT NOT NULL,
      "symbol"    TEXT NOT NULL,
      "shares"    DOUBLE PRECISION NOT NULL,
      "priceUsd"  DOUBLE PRECISION NOT NULL,
      "krwAmount" DOUBLE PRECISION,
      "usdKrw"    DOUBLE PRECISION,
      "note"      TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET() {
  try {
    await ensureTable();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "TqqqLog" ORDER BY "date" DESC, "createdAt" DESC`
    );
    return NextResponse.json({ logs: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { date, symbol, shares, priceUsd, krwAmount, usdKrw, note } = body;
    if (!date || !symbol || !shares || !priceUsd) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "TqqqLog" ("date","symbol","shares","priceUsd","krwAmount","usdKrw","note")
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      date, symbol, Number(shares), Number(priceUsd),
      krwAmount ? Number(krwAmount) : null,
      usdKrw    ? Number(usdKrw)   : null,
      note || null,
    );
    return NextResponse.json({ log: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.$executeRawUnsafe(`DELETE FROM "TqqqLog" WHERE id=$1`, id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
