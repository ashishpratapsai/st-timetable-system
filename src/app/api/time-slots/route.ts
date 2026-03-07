import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const slots = await prisma.timeSlot.findMany({
    orderBy: { order: "asc" },
  });

  return NextResponse.json(slots);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { startTime, endTime, label, order } = body;

  if (!startTime || !endTime || !label) {
    return NextResponse.json(
      { error: "Start time, end time, and label are required" },
      { status: 400 }
    );
  }

  const slot = await prisma.timeSlot.create({
    data: { startTime, endTime, label, order: order || 0 },
  });

  return NextResponse.json(slot, { status: 201 });
}
