import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const classroomId = req.nextUrl.searchParams.get("classroomId");
  const dateFrom = req.nextUrl.searchParams.get("dateFrom");
  const dateTo = req.nextUrl.searchParams.get("dateTo");

  const where: Record<string, unknown> = {};
  if (classroomId) where.classroomId = classroomId;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
  }

  const blocks = await prisma.classroomAvailability.findMany({
    where,
    include: {
      classroom: { include: { center: { select: { name: true } } } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(blocks);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { classroomId, date, startTime, endTime, reason } = body;

  if (!classroomId || !date || !startTime || !endTime) {
    return NextResponse.json({ error: "classroomId, date, startTime, and endTime are required" }, { status: 400 });
  }

  const block = await prisma.classroomAvailability.create({
    data: {
      classroomId,
      date: new Date(date),
      startTime,
      endTime,
      reason: reason || null,
      isAvailable: false,
    },
    include: {
      classroom: { include: { center: { select: { name: true } } } },
    },
  });

  return NextResponse.json(block, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await prisma.classroomAvailability.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
