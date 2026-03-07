import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const assignments = await prisma.teachingAssignment.findMany({
    include: {
      teacher: {
        include: {
          user: { select: { name: true } },
        },
      },
      batch: {
        include: {
          center: { select: { name: true } },
        },
      },
      subject: true,
    },
    orderBy: [
      { teacher: { user: { name: "asc" } } },
      { batch: { name: "asc" } },
    ],
  });

  // Calculate weekly slots needed for each assignment
  const enriched = assignments.map((a) => {
    const startDate = new Date(a.startDate);
    const endDate = new Date(a.endDate);
    const totalWeeks = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    const remainingHours = a.totalHours - a.completedHours;
    const hoursPerWeek = remainingHours / totalWeeks;
    const slotsPerWeek = Math.ceil(hoursPerWeek / 1.5); // Each slot is 1.5 hours

    return {
      ...a,
      totalWeeks,
      remainingHours,
      hoursPerWeek: Math.round(hoursPerWeek * 10) / 10,
      slotsPerWeek,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { teacherId, batchId, subjectId, totalHours, startDate, endDate, notes } = body;

  if (!teacherId || !batchId || !subjectId || !totalHours || !startDate || !endDate) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  // Check for duplicate
  const existing = await prisma.teachingAssignment.findUnique({
    where: { teacherId_batchId_subjectId: { teacherId, batchId, subjectId } },
  });
  if (existing) {
    return NextResponse.json({ error: "This teacher-batch-subject assignment already exists" }, { status: 400 });
  }

  const assignment = await prisma.teachingAssignment.create({
    data: {
      teacherId,
      batchId,
      subjectId,
      totalHours: Number(totalHours),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      notes: notes || null,
    },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      batch: { include: { center: { select: { name: true } } } },
      subject: true,
    },
  });

  return NextResponse.json(assignment, { status: 201 });
}
