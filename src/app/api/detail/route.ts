import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSON } from "@/lib/serialize";
import { getPersonTimeline } from "@/lib/graph-queries";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const name = req.nextUrl.searchParams.get("name");
  const uid = req.nextUrl.searchParams.get("uid");
  if (!type || !name) return NextResponse.json({ error: "type and name required" }, { status: 400 });

  if (type === "person") {
    const person = uid
      ? await prisma.person.findUnique({ where: { personUid: uid }, include: {
          corpRelations: { include: { corp: { select: { companyName: true, corpCode: true, isAdmin: true, delistedAt: true } } } },
          fundRelations: { include: { fund: { select: { name: true, fundUid: true, fundType: true, flags: true } } } },
        }})
      : await prisma.person.findFirst({ where: { name }, include: {
          corpRelations: { include: { corp: { select: { companyName: true, corpCode: true, isAdmin: true, delistedAt: true } } } },
          fundRelations: { include: { fund: { select: { name: true, fundUid: true, fundType: true, flags: true } } } },
        }});
    if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const totalConnections = person.corpRelations.length + person.fundRelations.length;
    const suspiciousCorps = person.corpRelations.filter(r => r.corp.isAdmin || r.corp.delistedAt).length;
    const sameNameGroup = await prisma.sameNameGroup.findFirst({ where: { name: person.name } });
    const sameNameCount = sameNameGroup ? sameNameGroup.personIds.length : 1;
    const timeline = await getPersonTimeline(person.id);

    return NextResponse.json(toJSON({ ...person, totalConnections, suspiciousCorps, sameNameCount, timeline }));
  }

  if (type === "fund") {
    const fund = uid
      ? await prisma.fund.findUnique({ where: { fundUid: uid }, include: {
          corpRelations: { include: { corp: { select: { companyName: true, corpCode: true, isAdmin: true, delistedAt: true } } } },
          personRelations: { include: { person: { select: { name: true, personUid: true, flags: true } } } },
        }})
      : await prisma.fund.findFirst({ where: { name }, include: {
          corpRelations: { include: { corp: { select: { companyName: true, corpCode: true, isAdmin: true, delistedAt: true } } } },
          personRelations: { include: { person: { select: { name: true, personUid: true, flags: true } } } },
        }});
    if (!fund) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const totalConnections = fund.corpRelations.length + fund.personRelations.length;
    const suspiciousCorps = fund.corpRelations.filter(r => r.corp.isAdmin || r.corp.delistedAt).length;
    return NextResponse.json(toJSON({ ...fund, totalConnections, suspiciousCorps }));
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
