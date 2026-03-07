import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const classrooms = await prisma.classroom.findMany({
    include: {
      center: { select: { id: true, name: true } },
      _count: { select: { timetableEntries: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(classrooms);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { name, capacity, centerId, equipment } = body;

  if (!name || !capacity || !centerId) {
    return NextResponse.json(
      { error: "Name, capacity, and center are required" },
      { status: 400 }
    );
  }

  const classroom = await prisma.classroom.create({
    data: { name, capacity: Number(capacity), centerId, equipment: equipment || [] },
    include: { center: { select: { id: true, name: true } } },
  });

  return NextResponse.json(classroom, { status: 201 });
}
