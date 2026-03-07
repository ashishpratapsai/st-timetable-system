import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const classroom = await prisma.classroom.update({
    where: { id },
    data: {
      name: body.name,
      capacity: Number(body.capacity),
      centerId: body.centerId,
      equipment: body.equipment || [],
    },
  });

  return NextResponse.json(classroom);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await prisma.classroom.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
