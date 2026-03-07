import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/utils";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ progressId: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { progressId } = await params;

  const progress = await prisma.subtopicProgress.findUnique({
    where: { id: progressId },
  });

  if (!progress) {
    return NextResponse.json({ error: "Progress record not found" }, { status: 404 });
  }

  // Teachers can only undo their own; admins can undo any
  if (session!.user.role !== "ADMIN") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session!.user.id } });
    if (!teacher || teacher.id !== progress.teacherId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  await prisma.subtopicProgress.delete({ where: { id: progressId } });
  return NextResponse.json({ success: true });
}
