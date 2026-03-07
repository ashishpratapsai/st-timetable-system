import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const chapters = await prisma.chapter.findMany({
    where: { syllabusId: id },
    orderBy: { order: "asc" },
    include: {
      _count: { select: { subtopics: true } },
      assignments: {
        include: { teacher: { include: { user: { select: { name: true } } } } },
      },
    },
  });

  return NextResponse.json(chapters);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { name, description } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Auto-assign order
  const maxOrder = await prisma.chapter.aggregate({
    where: { syllabusId: id },
    _max: { order: true },
  });

  const chapter = await prisma.chapter.create({
    data: {
      syllabusId: id,
      name,
      description,
      order: (maxOrder._max.order ?? 0) + 1,
    },
    include: { _count: { select: { subtopics: true } } },
  });

  return NextResponse.json(chapter, { status: 201 });
}
