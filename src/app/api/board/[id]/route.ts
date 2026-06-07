import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSON } from "@/lib/serialize";
import crypto from "crypto";

// 게시글 상세
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const post = await prisma.boardPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toJSON(post));
}

// 게시글 삭제 (비밀번호 확인)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: "비밀번호가 필요합니다" }, { status: 400 });

  const post = await prisma.boardPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pwHash = crypto.createHash("sha256").update(password).digest("hex");
  if (pwHash !== post.password) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다" }, { status: 403 });
  }

  await prisma.boardPost.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
