import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/utils";
import { generateTimetable } from "@/lib/ai/timetable-generator";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { centerId, weekStart, scope } = body;

  try {
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
