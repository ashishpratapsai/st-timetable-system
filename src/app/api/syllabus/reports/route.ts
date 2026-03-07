import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const batchType = searchParams.get("batchType");
  const subjectId = searchParams.get("subjectId");
  const syllabusId = searchParams.get("syllabusId");
  const batchId = searchParams.get("batchId");

  const syllabi = await prisma.syllabus.findMany({
    where: {
      ...(syllabusId ? { id: syllabusId } : {}),
      ...(batchType ? { batchType: batchType as never } : {}),
      ...(subjectId ? { subjectId } : {}),
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      chapters: {
        include: {
          subtopics: {
            include: { progress: { include: { batch: { select: { id: true, name: true } } } } },
          },
          assignments: {
            where: batchId ? { batchId } : undefined,
            include: {
              teacher: { include: { user: { select: { name: true } } } },
              batch: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const reports = syllabi.map((syl) => {
    // Group by teacher+batch
    const teacherBatchMap = new Map<string, {
      teacherId: string;
      teacherName: string;
      batchId: string;
      batchName: string;
      assignedChapters: number;
      completedChapters: number;
      totalSubtopics: number;
      completedSubtopics: number;
      totalEstimatedHours: number;
      completedEstimatedHours: number;
      lastActivityDate: string | null;
    }>();

    for (const ch of syl.chapters) {
      for (const assignment of ch.assignments) {
        const key = `${assignment.teacherId}_${assignment.batchId}`;
        if (!teacherBatchMap.has(key)) {
          teacherBatchMap.set(key, {
            teacherId: assignment.teacherId,
            teacherName: assignment.teacher.user.name,
            batchId: assignment.batchId,
            batchName: assignment.batch.name,
            assignedChapters: 0,
            completedChapters: 0,
            totalSubtopics: 0,
            completedSubtopics: 0,
            totalEstimatedHours: 0,
            completedEstimatedHours: 0,
            lastActivityDate: null,
          });
        }

        const t = teacherBatchMap.get(key)!;
        t.assignedChapters++;
        t.totalSubtopics += ch.subtopics.length;

        let chapterComplete = ch.subtopics.length > 0;
        for (const st of ch.subtopics) {
          t.totalEstimatedHours += st.estimatedHours || 0;
          const teacherProgress = st.progress.find(
            (p) => p.teacherId === assignment.teacherId && p.batchId === assignment.batchId
          );
          if (teacherProgress) {
            t.completedSubtopics++;
            t.completedEstimatedHours += st.estimatedHours || 0;
            const date = teacherProgress.completedAt.toISOString();
            if (!t.lastActivityDate || date > t.lastActivityDate) {
              t.lastActivityDate = date;
            }
          } else {
            chapterComplete = false;
          }
        }
        if (chapterComplete) t.completedChapters++;
      }
    }

    const teacherProgress = Array.from(teacherBatchMap.values()).map((t) => ({
      ...t,
      percentComplete: t.totalSubtopics > 0 ? Math.round((t.completedSubtopics / t.totalSubtopics) * 100) : 0,
    }));

    const totalSubtopics = syl.chapters.reduce((sum, ch) => sum + ch.subtopics.length, 0);
    const totalCompleted = syl.chapters.reduce(
      (sum, ch) => sum + ch.subtopics.filter((st) => st.progress.length > 0).length,
      0
    );
    const totalEstimatedHours = syl.chapters.reduce(
      (sum, ch) => sum + ch.subtopics.reduce((s2, st) => s2 + (st.estimatedHours || 0), 0),
      0
    );

    return {
      syllabusId: syl.id,
      syllabusName: syl.name,
      batchType: syl.batchType,
      subject: syl.subject,
      totalChapters: syl.chapters.length,
      totalSubtopics,
      overallCompleted: totalCompleted,
      overallPercent: totalSubtopics > 0 ? Math.round((totalCompleted / totalSubtopics) * 100) : 0,
      totalEstimatedHours: totalEstimatedHours > 0 ? totalEstimatedHours : null,
      teacherProgress,
    };
  });

  return NextResponse.json(reports);
}
