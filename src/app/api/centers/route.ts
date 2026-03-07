import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const centers = await prisma.center.findMany({
    include: {
      _count: { select: { classrooms: true, batches: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(centers);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { name, address, phone } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const center = await prisma.center.create({
    data: { name, address, phone },
  });

  return NextResponse.json(center, { status: 201 });
}
