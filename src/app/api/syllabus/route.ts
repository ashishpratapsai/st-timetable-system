import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const batchType = searchParams.get("batchType");

  const syllabi = await prisma.syllabus.findMany({
    where: batchType ? { batchType: batchType as never } : undefined,
    include: {
      subject: { select: { id: true, name: true, code: true } },
      chapters: {
        include: {
          _count: { select: { subtopics: true } },
          subtopics: {
            include: { _count: { select: { progress: true } } },
          },
          assignments: {
            include: {
              teacher: { include: { user: { select: { name: true } } } },
              batch: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: [{ batchType: "asc" }, { name: "asc" }],
  });

  // Compute progress stats
  const result = syllabi.map((s) => {
    const totalSubtopics = s.chapters.reduce((sum, ch) => sum + ch.subtopics.length, 0);
    const completedSubtopics = s.chapters.reduce(
      (sum, ch) => sum + ch.subtopics.reduce((s2, st) => s2 + st._count.progress, 0),
      0
    );
    const totalChapters = s.chapters.length;
    const assignedTeachers = [...new Set(s.chapters.flatMap((ch) => ch.assignments.map((a) => a.teacher.user.name)))];
    const totalEstimatedHours = s.chapters.reduce(
      (sum, ch) => sum + ch.subtopics.reduce((s2, st) => s2 + (st.estimatedHours || 0), 0),
      0
    );

    return {
      id: s.id,
      name: s.name,
      description: s.description,
      batchType: s.batchType,
      subject: s.subject,
      totalChapters,
      totalSubtopics,
      completedSubtopics,
      progressPercent: totalSubtopics > 0 ? Math.round((completedSubtopics / totalSubtopics) * 100) : 0,
      totalEstimatedHours: totalEstimatedHours > 0 ? totalEstimatedHours : null,
      assignedTeachers,
      createdAt: s.createdAt,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { batchType, subjectId, name, description } = body;

  if (!batchType || !subjectId || !name) {
    return NextResponse.json({ error: "batchType, subjectId, and name are required" }, { status: 400 });
  }

  // Check unique constraint
  const existing = await prisma.syllabus.findUnique({
    where: { batchType_subjectId: { batchType, subjectId } },
  });
  if (existing) {
    return NextResponse.json({ error: "A syllabus already exists for this batch type and subject" }, { status: 400 });
  }

  const syllabus = await prisma.syllabus.create({
    data: { batchType, subjectId, name, description },
    include: { subject: { select: { id: true, name: true, code: true } } },
  });

  return NextResponse.json(syllabus, { status: 201 });
}
