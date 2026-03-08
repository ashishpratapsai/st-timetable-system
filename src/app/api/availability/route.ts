import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const teacherId = req.nextUrl.searchParams.get("teacherId");

  // teacherId is optional — if omitted, fetch all teachers' availability
  const where: Record<string, unknown> = {};
  if (teacherId) where.teacherId = teacherId;

  const availability = await prisma.teacherAvailability.findMany({
    where,
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(availability);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const { teacherId, availability } = body;

  // Delete existing availability for this teacher
  await prisma.teacherAvailability.deleteMany({ where: { teacherId } });

  // Create new availability entries
  if (availability && availability.length > 0) {
    await prisma.teacherAvailability.createMany({
      data: availability.map((a: { dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }) => ({
        teacherId,
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        isAvailable: a.isAvailable,
      })),
    });
  }

  return NextResponse.json({ success: true });
}
