import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const scope = req.nextUrl.searchParams.get("scope");

  const where: Record<string, unknown> = {};
  if (scope && scope !== "all") {
    where.OR = [{ scope }, { scope: "all" }];
  }

  const slots = await prisma.timeSlot.findMany({
    where,
    orderBy: { order: "asc" },
  });

  return NextResponse.json(slots);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { startTime, endTime, label, order, scope } = body;

  if (!startTime || !endTime || !label) {
    return NextResponse.json(
      { error: "Start time, end time, and label are required" },
      { status: 400 }
    );
  }

  const slot = await prisma.timeSlot.create({
    data: { startTime, endTime, label, order: order || 0, scope: scope || "all" },
  });

  return NextResponse.json(slot, { status: 201 });
}
