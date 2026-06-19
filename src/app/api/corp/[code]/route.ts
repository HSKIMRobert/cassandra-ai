import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSON } from "@/lib/serialize";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const decoded = decodeURIComponent(code);
  const corp = await prisma.corp.findFirst({
    where: {
      OR: [
        { corpCode: decoded },
        { stockCode: decoded },
        { companyName: { contains: decoded, mode: "insensitive" } },
      ],
    },
    include: {
      personRelations: { include: { person: true } },
      fundRelations: { include: { fund: true } },
      filings: { orderBy: { filedAt: "desc" } },
      signals: { orderBy: { firedAt: "desc" } },
    },
  });
  if (!corp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toJSON(corp));
}
