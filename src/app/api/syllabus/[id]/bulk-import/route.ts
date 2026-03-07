import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { chapters } = body as { chapters: { name: string; subtopics: (string | { name: string; estimatedHours?: number })[] }[] };

  if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
    return NextResponse.json({ error: "chapters array is required" }, { status: 400 });
  }

  // Get current max order
  const maxOrder = await prisma.chapter.aggregate({
    where: { syllabusId: id },
    _max: { order: true },
  });
  let currentOrder = (maxOrder._max.order ?? 0);

  const created = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const ch of chapters) {
      currentOrder++;
      const chapter = await tx.chapter.create({
        data: {
          syllabusId: id,
          name: ch.name.trim(),
          order: currentOrder,
          subtopics: {
            create: (ch.subtopics || []).map((st, j: number) => ({
              name: (typeof st === "string" ? st : st.name).trim(),
              order: j + 1,
              estimatedHours: typeof st === "object" && st.estimatedHours != null ? st.estimatedHours : null,
            })),
          },
        },
        include: { subtopics: true },
      });
      results.push(chapter);
    }
    return results;
  });

  return NextResponse.json({
    imported: created.length,
    totalSubtopics: created.reduce((sum, ch) => sum + ch.subtopics.length, 0),
    chapters: created,
  }, { status: 201 });
}
