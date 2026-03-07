import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { chapterId } = await params;

  const subtopics = await prisma.subtopic.findMany({
    where: { chapterId },
    orderBy: { order: "asc" },
    include: {
      progress: {
        include: { teacher: { include: { user: { select: { name: true } } } } },
      },
    },
  });

  return NextResponse.json(subtopics);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { chapterId } = await params;
  const body = await req.json();
  const { name, estimatedHours } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const maxOrder = await prisma.subtopic.aggregate({
    where: { chapterId },
    _max: { order: true },
  });

  const subtopic = await prisma.subtopic.create({
    data: {
      chapterId,
      name,
      order: (maxOrder._max.order ?? 0) + 1,
      estimatedHours: estimatedHours != null ? parseFloat(estimatedHours) : null,
    },
  });

  return NextResponse.json(subtopic, { status: 201 });
}
