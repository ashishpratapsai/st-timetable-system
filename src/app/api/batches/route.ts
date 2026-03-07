import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const batches = await prisma.batch.findMany({
    include: {
      center: { select: { id: true, name: true } },
      batchSubjects: { include: { subject: true } },
      _count: { select: { timetableEntries: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(batches);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { name, batchType, centerId, strength, subjects } = body;

  if (!name || !batchType || !centerId || !strength) {
    return NextResponse.json(
      { error: "Name, type, center, and strength are required" },
      { status: 400 }
    );
  }

  const batch = await prisma.batch.create({
    data: {
      name,
      batchType,
      centerId,
      strength: Number(strength),
      status: "ACTIVE",
      batchSubjects: {
        create: (subjects || []).map(
          (s: { subjectId: string; hoursPerWeek: number }) => ({
            subjectId: s.subjectId,
            hoursPerWeek: Number(s.hoursPerWeek),
          })
        ),
      },
    },
    include: {
      center: { select: { id: true, name: true } },
      batchSubjects: { include: { subject: true } },
    },
  });

  return NextResponse.json(batch, { status: 201 });
}
