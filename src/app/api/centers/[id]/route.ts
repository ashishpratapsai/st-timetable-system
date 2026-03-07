import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const center = await prisma.center.update({
    where: { id },
    data: { name: body.name, address: body.address, phone: body.phone },
  });

  return NextResponse.json(center);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  await prisma.center.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
