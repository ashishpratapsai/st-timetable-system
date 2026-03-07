import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { totalHours, completedHours, startDate, endDate, notes } = body;

  const updated = await prisma.teachingAssignment.update({
    where: { id },
    data: {
      ...(totalHours !== undefined && { totalHours: Number(totalHours) }),
      ...(completedHours !== undefined && { completedHours: Number(completedHours) }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(notes !== undefined && { notes: notes || null }),
    },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      batch: { include: { center: { select: { name: true } } } },
      subject: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await prisma.teachingAssignment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
