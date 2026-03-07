import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { entries, weekStart } = body;

  const weekDate = new Date(weekStart);

  // Delete existing entries for this week
  await prisma.timetableEntry.deleteMany({
    where: { weekStart: weekDate },
  });

  // Create new entries
  const created = await prisma.timetableEntry.createMany({
    data: entries.map(
      (e: {
        batchId: string;
        subjectId: string;
        teacherId: string;
        classroomId: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        classType?: string;
      }) => ({
        batchId: e.batchId,
        subjectId: e.subjectId,
        teacherId: e.teacherId,
        classroomId: e.classroomId,
        dayOfWeek: e.dayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
        weekStart: weekDate,
        status: "SCHEDULED",
        classType: e.classType || "ACTUAL",
      })
    ),
  });

  // Log generation
  await prisma.timetableGeneration.create({
    data: {
      weekStart: weekDate,
      status: "COMPLETED",
      aiResponse: { entriesCount: created.count },
      createdBy: session!.user.id,
    },
  });

  return NextResponse.json({ success: true, count: created.count });
}
