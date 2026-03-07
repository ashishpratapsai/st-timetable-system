import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/utils";

const ENTRY_INCLUDE = {
  batch: { select: { id: true, name: true, batchType: true } },
  subject: { select: { id: true, name: true, code: true } },
  teacher: { include: { user: { select: { name: true } } } },
  substituteTeacher: { include: { user: { select: { name: true } } } },
  classroom: { include: { center: { select: { name: true } } } },
};

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const weekStart = req.nextUrl.searchParams.get("weekStart");
  const centerId = req.nextUrl.searchParams.get("centerId");
  const teacherId = req.nextUrl.searchParams.get("teacherId");
  const batchId = req.nextUrl.searchParams.get("batchId");
  const classroomId = req.nextUrl.searchParams.get("classroomId");

  const where: Record<string, unknown> = {};
  if (weekStart) where.weekStart = new Date(weekStart);
  if (centerId) where.classroom = { centerId };
  if (teacherId) where.teacherId = teacherId;
  if (batchId) where.batchId = batchId;
  if (classroomId) where.classroomId = classroomId;

  const entries = await prisma.timetableEntry.findMany({
    where,
    include: ENTRY_INCLUDE,
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { batchId, subjectId, teacherId, classroomId, dayOfWeek, startTime, endTime, weekStart } = body;

  if (!batchId || !subjectId || !teacherId || !classroomId || dayOfWeek === undefined || !startTime || !endTime || !weekStart) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const weekDate = new Date(weekStart);

  // Check teacher conflict
  const teacherConflict = await prisma.timetableEntry.findFirst({
    where: {
      teacherId,
      dayOfWeek,
      startTime,
      weekStart: weekDate,
      status: { in: ["SCHEDULED", "SUBSTITUTED"] },
    },
  });
  if (teacherConflict) {
    return NextResponse.json({ error: "Teacher is already booked at this time" }, { status: 409 });
  }

  // Check classroom conflict
  const roomConflict = await prisma.timetableEntry.findFirst({
    where: {
      classroomId,
      dayOfWeek,
      startTime,
      weekStart: weekDate,
      status: { in: ["SCHEDULED", "SUBSTITUTED"] },
    },
  });
  if (roomConflict) {
    return NextResponse.json({ error: "Classroom is already booked at this time" }, { status: 409 });
  }

  // Check batch conflict (same batch can't have two classes at same time)
  const batchConflict = await prisma.timetableEntry.findFirst({
    where: {
      batchId,
      dayOfWeek,
      startTime,
      weekStart: weekDate,
      status: { in: ["SCHEDULED", "SUBSTITUTED"] },
    },
  });
  if (batchConflict) {
    return NextResponse.json({ error: "Batch already has a class at this time" }, { status: 409 });
  }

  const entry = await prisma.timetableEntry.create({
    data: {
      batchId,
      subjectId,
      teacherId,
      classroomId,
      dayOfWeek,
      startTime,
      endTime,
      weekStart: weekDate,
      status: "SCHEDULED",
    },
    include: ENTRY_INCLUDE,
  });

  return NextResponse.json(entry, { status: 201 });
}
