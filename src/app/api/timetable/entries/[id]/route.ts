import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { teacherId, classroomId, status } = body;

  const entry = await prisma.timetableEntry.findUnique({ where: { id } });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  // Conflict check if changing teacher
  if (teacherId && teacherId !== entry.teacherId) {
    const teacherConflict = await prisma.timetableEntry.findFirst({
      where: {
        OR: [
          { teacherId },
          { substituteTeacherId: teacherId },
        ],
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        weekStart: entry.weekStart,
        status: { in: ["SCHEDULED", "SUBSTITUTED"] },
        id: { not: id },
      },
    });
    if (teacherConflict) {
      return NextResponse.json({ error: "Teacher is already booked at this time" }, { status: 400 });
    }
  }

  // Conflict check if changing classroom
  if (classroomId && classroomId !== entry.classroomId) {
    const roomConflict = await prisma.timetableEntry.findFirst({
      where: {
        classroomId,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        weekStart: entry.weekStart,
        status: { in: ["SCHEDULED", "SUBSTITUTED"] },
        id: { not: id },
      },
    });
    if (roomConflict) {
      return NextResponse.json({ error: "Classroom is already booked at this time" }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (teacherId) updateData.teacherId = teacherId;
  if (classroomId) updateData.classroomId = classroomId;
  if (status) updateData.status = status;

  const updated = await prisma.timetableEntry.update({
    where: { id },
    data: updateData,
    include: {
      batch: { select: { name: true } },
      subject: { select: { name: true, code: true } },
      teacher: { include: { user: { select: { name: true } } } },
      substituteTeacher: { include: { user: { select: { name: true } } } },
      classroom: { select: { name: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const entry = await prisma.timetableEntry.findUnique({ where: { id } });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  // Soft delete - set status to CANCELLED
  await prisma.timetableEntry.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ success: true });
}
