import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { chapterId } = await params;
  const body = await req.json();
  const { name, description, order } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (order !== undefined) data.order = order;

  const chapter = await prisma.chapter.update({
    where: { id: chapterId },
    data,
  });

  return NextResponse.json(chapter);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { chapterId } = await params;
  await prisma.chapter.delete({ where: { id: chapterId } });
  return NextResponse.json({ success: true });
}
