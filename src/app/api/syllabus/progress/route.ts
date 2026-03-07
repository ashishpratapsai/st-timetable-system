import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const syllabusId = searchParams.get("syllabusId");
  const requestedTeacherId = searchParams.get("teacherId");
  const batchId = searchParams.get("batchId");

  const isAdmin = session!.user.role === "ADMIN";

  // Get the teacher record for the current user
  let teacherId = requestedTeacherId;
  if (!teacherId) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session!.user.id } });
    if (!teacher) {
      return NextResponse.json([]);
    }
    teacherId = teacher.id;
  }

  // Get all chapter assignments for this teacher
  const assignments = await prisma.chapterAssignment.findMany({
    where: {
      teacherId,
      ...(syllabusId ? { chapter: { syllabusId } } : {}),
      ...(batchId ? { batchId } : {}),
    },
    include: {
      batch: { select: { id: true, name: true, batchType: true } },
      chapter: {
        include: {
          syllabus: {
            include: { subject: { select: { id: true, name: true, code: true } } },
          },
          subtopics: {
            orderBy: { order: "asc" },
            include: {
              progress: {
                where: {
                  teacherId,
                  ...(batchId ? { batchId } : {}),
                },
              },
            },
          },
        },
      },
    },
    orderBy: { chapter: { order: "asc" } },
  });

  // Group by syllabus+batch
  const groupMap = new Map<string, {
    syllabusId: string;
    syllabusName: string;
    batchType: string;
    batchId: string;
    batchName: string;
    subject: { id: string; name: string; code: string };
    chapters: Array<{
      id: string;
      name: string;
      order: number;
      subtopics: Array<{
        id: string;
        name: string;
        order: number;
        estimatedHours: number | null;
        completed: boolean;
        completedAt: string | null;
      }>;
      totalSubtopics: number;
      completedSubtopics: number;
      totalEstimatedHours: number;
      completedEstimatedHours: number;
    }>;
  }>();

  for (const a of assignments) {
    const syl = a.chapter.syllabus;
    const key = `${syl.id}_${a.batchId}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        syllabusId: syl.id,
        syllabusName: syl.name,
        batchType: syl.batchType,
        batchId: a.batchId,
        batchName: a.batch.name,
        subject: syl.subject,
        chapters: [],
      });
    }

    // Filter progress to matching batch
    const completedCount = a.chapter.subtopics.filter((st) =>
      st.progress.some((p) => p.batchId === a.batchId)
    ).length;

    const totalEstHours = a.chapter.subtopics.reduce((s, st) => s + (st.estimatedHours || 0), 0);
    const completedEstHours = a.chapter.subtopics
      .filter((st) => st.progress.some((p) => p.batchId === a.batchId))
      .reduce((s, st) => s + (st.estimatedHours || 0), 0);

    groupMap.get(key)!.chapters.push({
      id: a.chapter.id,
      name: a.chapter.name,
      order: a.chapter.order,
      subtopics: a.chapter.subtopics.map((st) => {
        const prog = st.progress.find((p) => p.batchId === a.batchId);
        return {
          id: st.id,
          name: st.name,
          order: st.order,
          estimatedHours: st.estimatedHours,
          completed: !!prog,
          completedAt: prog?.completedAt?.toISOString() || null,
        };
      }),
      totalSubtopics: a.chapter.subtopics.length,
      completedSubtopics: completedCount,
      totalEstimatedHours: totalEstHours,
      completedEstimatedHours: completedEstHours,
    });
  }

  return NextResponse.json(Array.from(groupMap.values()));
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const { subtopicId, batchId } = body;

  if (!subtopicId || !batchId) {
    return NextResponse.json({ error: "subtopicId and batchId are required" }, { status: 400 });
  }

  // Get teacher record
  const teacher = await prisma.teacher.findUnique({ where: { userId: session!.user.id } });
  if (!teacher) {
    return NextResponse.json({ error: "Teacher record not found" }, { status: 404 });
  }

  // Verify the subtopic exists and teacher is assigned to its chapter for this batch
  const subtopic = await prisma.subtopic.findUnique({
    where: { id: subtopicId },
    include: {
      chapter: {
        include: { assignments: { where: { teacherId: teacher.id, batchId } } },
      },
    },
  });

  if (!subtopic) {
    return NextResponse.json({ error: "Subtopic not found" }, { status: 404 });
  }

  // Allow admin to mark any subtopic, teachers only their assigned ones
  if (session!.user.role !== "ADMIN" && subtopic.chapter.assignments.length === 0) {
    return NextResponse.json({ error: "You are not assigned to this chapter for this batch" }, { status: 403 });
  }

  // Create progress record
  try {
    const progress = await prisma.subtopicProgress.create({
      data: { subtopicId, teacherId: teacher.id, batchId },
    });
    return NextResponse.json(progress, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Subtopic already marked as complete for this batch" }, { status: 400 });
  }
}
