import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/utils";
import { generateTimetable, validateBeforeGeneration } from "@/lib/ai/timetable-generator";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { centerId, weekStart, scope, mode } = body;

  try {
    // Validation mode — check for issues before generating
    if (mode === "validate") {
      const customPromptSetting = await prisma.settings.findUnique({
        where: { key: "ai_custom_prompt" },
      });
      const issues = await validateBeforeGeneration(
        centerId || null,
        new Date(weekStart),
        (scope as "senior" | "junior" | "all") || "all",
        customPromptSetting?.value || "",
      );
      return NextResponse.json({ issues });
    }

    const result = await generateTimetable(
      centerId || null,
      new Date(weekStart),
      (scope as "senior" | "junior" | "all") || "all"
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
