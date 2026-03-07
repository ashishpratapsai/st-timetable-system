import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string; subtopicId: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { subtopicId } = await params;
  const body = await req.json();
  const { name, order, estimatedHours } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (order !== undefined) data.order = order;
  if (estimatedHours !== undefined) data.estimatedHours = estimatedHours != null ? parseFloat(estimatedHours) : null;

  const subtopic = await prisma.subtopic.update({
    where: { id: subtopicId },
    data,
  });

  return NextResponse.json(subtopic);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string; subtopicId: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { subtopicId } = await params;
  await prisma.subtopic.delete({ where: { id: subtopicId } });
  return NextResponse.json({ success: true });
}
