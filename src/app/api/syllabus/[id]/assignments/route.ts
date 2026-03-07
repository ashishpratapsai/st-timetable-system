import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");

  const assignments = await prisma.chapterAssignment.findMany({
    where: {
      chapter: { syllabusId: id },
      ...(batchId ? { batchId } : {}),
    },
    include: {
      chapter: { select: { id: true, name: true, order: true } },
      teacher: { include: { user: { select: { name: true } } } },
      batch: { select: { id: true, name: true, batchType: true } },
    },
    orderBy: { chapter: { order: "asc" } },
  });

  return NextResponse.json(assignments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { teacherId, chapterIds, batchId } = body as { teacherId: string; chapterIds: string[]; batchId: string };

  if (!teacherId || !chapterIds || chapterIds.length === 0 || !batchId) {
    return NextResponse.json({ error: "teacherId, chapterIds, and batchId are required" }, { status: 400 });
  }

  // Validate teacher teaches this subject
  const syllabus = await prisma.syllabus.findUnique({ where: { id }, select: { subjectId: true, batchType: true } });
  if (!syllabus) {
    return NextResponse.json({ error: "Syllabus not found" }, { status: 404 });
  }

  // Validate batch matches syllabus batchType
  const batch = await prisma.batch.findUnique({ where: { id: batchId }, select: { batchType: true } });
  if (!batch || batch.batchType !== syllabus.batchType) {
    return NextResponse.json({ error: "Batch type does not match syllabus" }, { status: 400 });
  }

  const teacherSubject = await prisma.teacherSubject.findUnique({
    where: { teacherId_subjectId: { teacherId, subjectId: syllabus.subjectId } },
  });
  if (!teacherSubject) {
    return NextResponse.json({ error: "Teacher does not teach this subject" }, { status: 400 });
  }

  // Create assignments (skip duplicates)
  const created = [];
  for (const chapterId of chapterIds) {
    try {
      const assignment = await prisma.chapterAssignment.create({
        data: { chapterId, teacherId, batchId },
        include: {
          chapter: { select: { id: true, name: true } },
          teacher: { include: { user: { select: { name: true } } } },
          batch: { select: { id: true, name: true } },
        },
      });
      created.push(assignment);
    } catch {
      // Skip duplicate assignments (unique constraint violation)
    }
  }

  return NextResponse.json({ assigned: created.length, assignments: created }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { teacherId, chapterIds, batchId } = body as { teacherId: string; chapterIds: string[]; batchId: string };

  if (!teacherId || !chapterIds || chapterIds.length === 0 || !batchId) {
    return NextResponse.json({ error: "teacherId, chapterIds, and batchId are required" }, { status: 400 });
  }

  await prisma.chapterAssignment.deleteMany({
    where: {
      teacherId,
      chapterId: { in: chapterIds },
      batchId,
    },
  });

  return NextResponse.json({ success: true });
}
