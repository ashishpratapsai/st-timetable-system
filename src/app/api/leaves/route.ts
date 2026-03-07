import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const isAdmin = session!.user.role === "ADMIN";
  const teacherId = req.nextUrl.searchParams.get("teacherId");

  const where: Record<string, unknown> = {};

  if (!isAdmin) {
    // Teacher can only see their own leaves
    const teacher = await prisma.teacher.findUnique({
      where: { userId: session!.user.id },
    });
    if (teacher) where.teacherId = teacher.id;
  } else if (teacherId) {
    where.teacherId = teacherId;
  }

  const leaves = await prisma.leave.findMany({
    where,
    include: {
      teacher: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(leaves);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const { leaveType, startDate, endDate, reason } = body;

  // Find teacher for current user
  const teacher = await prisma.teacher.findUnique({
    where: { userId: session!.user.id },
  });

  if (!teacher) {
    return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
  }

  const leave = await prisma.leave.create({
    data: {
      teacherId: teacher.id,
      leaveType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
    },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
    },
  });

  return NextResponse.json(leave, { status: 201 });
}
