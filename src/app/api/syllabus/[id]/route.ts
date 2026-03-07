import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const syllabus = await prisma.syllabus.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      chapters: {
        orderBy: { order: "asc" },
        include: {
          subtopics: {
            orderBy: { order: "asc" },
            include: {
              progress: {
                include: {
                  teacher: { include: { user: { select: { name: true } } } },
                  batch: { select: { id: true, name: true } },
                },
              },
            },
          },
          assignments: {
            include: {
              teacher: { include: { user: { select: { name: true } } } },
              batch: { select: { id: true, name: true, batchType: true } },
            },
          },
        },
      },
    },
  });

  if (!syllabus) {
    return NextResponse.json({ error: "Syllabus not found" }, { status: 404 });
  }

  return NextResponse.json(syllabus);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { name, description } = body;

  const syllabus = await prisma.syllabus.update({
    where: { id },
    data: { name, description },
    include: { subject: { select: { id: true, name: true, code: true } } },
  });

  return NextResponse.json(syllabus);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await prisma.syllabus.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
