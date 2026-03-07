import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      subjects: { include: { subject: { select: { id: true, name: true, code: true } } } },
    },
  });

  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  return NextResponse.json(teacher);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { name, phone, shortCode, employmentType, subjectIds } = body;

  // Get teacher to find userId
  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  // Update user info
  await prisma.user.update({
    where: { id: teacher.userId },
    data: { name, phone },
  });

  // Update teacher
  await prisma.teacher.update({
    where: { id },
    data: { employmentType, ...(shortCode !== undefined && { shortCode: shortCode || null }) },
  });

  // Update subjects if provided
  if (subjectIds) {
    await prisma.teacherSubject.deleteMany({ where: { teacherId: id } });
    await prisma.teacherSubject.createMany({
      data: subjectIds.map((subjectId: string) => ({
        teacherId: id,
        subjectId,
      })),
    });
  }

  const updated = await prisma.teacher.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      subjects: { include: { subject: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  // Delete teacher and associated user
  await prisma.teacher.delete({ where: { id } });
  await prisma.user.delete({ where: { id: teacher.userId } });

  return NextResponse.json({ success: true });
}
