import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { name, batchType, centerId, strength, status, subjects } = body;

  await prisma.batch.update({
    where: { id },
    data: { name, batchType, centerId, strength: Number(strength), status },
  });

  // Update subjects if provided
  if (subjects) {
    await prisma.$transaction(async (tx) => {
      await tx.batchSubject.deleteMany({ where: { batchId: id } });
      await tx.batchSubject.createMany({
        data: subjects.map((s: { subjectId: string; hoursPerWeek: number }) => ({
          batchId: id,
          subjectId: s.subjectId,
          hoursPerWeek: Number(s.hoursPerWeek),
        })),
      });
    });
  }

  const updated = await prisma.batch.findUnique({
    where: { id },
    include: {
      center: { select: { id: true, name: true } },
      batchSubjects: { include: { subject: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await prisma.batch.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
