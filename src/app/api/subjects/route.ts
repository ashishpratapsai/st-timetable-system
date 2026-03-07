import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const subjects = await prisma.subject.findMany({
    include: {
      _count: { select: { teacherSubjects: true, batchSubjects: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(subjects);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { name, code } = body;

  if (!name || !code) {
    return NextResponse.json({ error: "Name and code are required" }, { status: 400 });
  }

  const subject = await prisma.subject.create({
    data: { name, code: code.toUpperCase() },
  });

  return NextResponse.json(subject, { status: 201 });
}
