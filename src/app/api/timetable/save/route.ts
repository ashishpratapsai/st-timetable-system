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

  // ─── Version Management ───

  // Count existing versions for this week+scope to generate label
  const existingVersions = await prisma.timetableGeneration.findMany({
    where: {
      weekStart: weekDate,
      ...(scopeValue !== "all" ? { scope: scopeValue } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  // Cap at 5 versions
  if (existingVersions.length >= 5) {
    return NextResponse.json(
      { error: "Maximum 5 versions per week. Delete an old version to generate a new one." },
      { status: 400 }
    );
  }

  const versionNumber = existingVersions.length + 1;
  const versionLabel = `Version ${versionNumber}`;

  // Deactivate previous active entries for this scope
  const batchTypeFilter = scopeValue === "senior"
    ? { batch: { batchType: { in: SENIOR_BATCH_TYPES } } }
    : scopeValue === "junior"
      ? { batch: { batchType: { notIn: SENIOR_BATCH_TYPES } } }
      : {};

  await prisma.timetableEntry.updateMany({
    where: { weekStart: weekDate, isActive: true, ...batchTypeFilter },
    data: { isActive: false },
  });

  // Deactivate previous active versions
  await prisma.timetableGeneration.updateMany({
    where: {
      weekStart: weekDate,
      isActive: true,
      ...(scopeValue !== "all" ? { scope: scopeValue } : {}),
    },
    data: { isActive: false },
  });

  // Validate new entries don't conflict with retained active entries from the other scope
  if (scopeValue !== "all") {
    const retainedEntries = await prisma.timetableEntry.findMany({
      where: { weekStart: weekDate, isActive: true },
      select: { teacherId: true, classroomId: true, dayOfWeek: true, startTime: true },
    });

    for (const retained of retainedEntries) {
      const timeKey = `${retained.dayOfWeek}-${retained.startTime}`;
      if (teacherSlots.has(retained.teacherId) && teacherSlots.get(retained.teacherId)!.has(timeKey)) {
        conflicts.push(`Teacher conflicts with existing ${scopeValue === "senior" ? "junior" : "senior"} entry`);
      }
      if (classroomSlots.has(retained.classroomId) && classroomSlots.get(retained.classroomId)!.has(timeKey)) {
        conflicts.push(`Classroom conflicts with existing entry`);
      }
    }

    if (conflicts.length > 0) {
      // Rollback: re-activate the entries we just deactivated
      await prisma.timetableEntry.updateMany({
        where: { weekStart: weekDate, isActive: false, ...batchTypeFilter },
        data: { isActive: true },
      });
      return NextResponse.json(
        { error: `Cannot save: conflicts with existing ${scopeValue === "senior" ? "junior" : "senior"} timetable`, conflicts },
        { status: 409 }
      );
    }
  }

  // Create the version record
  const version = await prisma.timetableGeneration.create({
    data: {
      weekStart: weekDate,
      scope: scopeValue,
      status: "COMPLETED",
      aiResponse: { entriesCount: entries.length },
      entryCount: entries.length,
      label: versionLabel,
      isActive: true,
      createdBy: session!.user.id,
    },
  });

  // Create new entries with versionId
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
        versionId: version.id,
        isActive: true,
      })
    ),
  });

  return NextResponse.json({
    success: true,
    count: created.count,
    versionId: version.id,
    versionLabel,
  });
}
