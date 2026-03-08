import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";
import { BatchType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { entries, weekStart, scope } = body;
  const scopeValue = (scope as "senior" | "junior" | "all") || "all";

  const SENIOR_BATCH_TYPES: BatchType[] = [BatchType.IIT_JEE, BatchType.JEE_MAINS, BatchType.NEET];
  const weekDate = new Date(weekStart);

  // ─── Server-side conflict validation (safety net) ───
  const teacherSlots = new Map<string, Set<string>>();
  const classroomSlots = new Map<string, Set<string>>();
  const conflicts: string[] = [];

  for (const e of entries) {
    const timeKey = `${e.dayOfWeek}-${e.startTime}`;

    // Check teacher double-booking
    if (!teacherSlots.has(e.teacherId)) teacherSlots.set(e.teacherId, new Set());
    if (teacherSlots.get(e.teacherId)!.has(timeKey)) {
      conflicts.push(`Teacher ${e.teacherId} double-booked at day ${e.dayOfWeek}, ${e.startTime}`);
    }
    teacherSlots.get(e.teacherId)!.add(timeKey);

    // Check classroom double-booking
    if (!classroomSlots.has(e.classroomId)) classroomSlots.set(e.classroomId, new Set());
    if (classroomSlots.get(e.classroomId)!.has(timeKey)) {
      conflicts.push(`Classroom ${e.classroomId} double-booked at day ${e.dayOfWeek}, ${e.startTime}`);
    }
    classroomSlots.get(e.classroomId)!.add(timeKey);
  }

  if (conflicts.length > 0) {
    return NextResponse.json(
      { error: `Cannot save: ${conflicts.length} conflicts detected`, conflicts },
      { status: 409 }
    );
  }

  // Delete existing entries for this week — scoped to avoid wiping the other scope
  if (scopeValue === "senior") {
    await prisma.timetableEntry.deleteMany({
      where: { weekStart: weekDate, batch: { batchType: { in: SENIOR_BATCH_TYPES } } },
    });
  } else if (scopeValue === "junior") {
    await prisma.timetableEntry.deleteMany({
      where: { weekStart: weekDate, batch: { batchType: { notIn: SENIOR_BATCH_TYPES } } },
    });
  } else {
    await prisma.timetableEntry.deleteMany({
      where: { weekStart: weekDate },
    });
  }

  // Validate new entries don't conflict with retained entries from the other scope
  if (scopeValue !== "all") {
    const retainedEntries = await prisma.timetableEntry.findMany({
      where: { weekStart: weekDate },
      select: { teacherId: true, classroomId: true, dayOfWeek: true, startTime: true },
    });

    for (const retained of retainedEntries) {
      const timeKey = `${retained.dayOfWeek}-${retained.startTime}`;
      if (teacherSlots.has(retained.teacherId) && teacherSlots.get(retained.teacherId)!.has(timeKey)) {
        conflicts.push(`Teacher ${retained.teacherId} conflicts with existing ${scopeValue === "senior" ? "junior" : "senior"} entry at day ${retained.dayOfWeek}, ${retained.startTime}`);
      }
      if (classroomSlots.has(retained.classroomId) && classroomSlots.get(retained.classroomId)!.has(timeKey)) {
        conflicts.push(`Classroom ${retained.classroomId} conflicts with existing entry at day ${retained.dayOfWeek}, ${retained.startTime}`);
      }
    }

    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: `Cannot save: ${conflicts.length} conflicts with existing ${scopeValue === "senior" ? "junior" : "senior"} timetable`, conflicts },
        { status: 409 }
      );
    }
  }

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
