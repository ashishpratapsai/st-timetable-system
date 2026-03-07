import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/utils";
import { assignSubstitute } from "@/lib/ai/substitute-finder";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id: leaveId } = await params;
  const body = await req.json();
  const { entryId, substituteTeacherId } = body;

  if (!entryId || !substituteTeacherId) {
    return NextResponse.json({ error: "entryId and substituteTeacherId are required" }, { status: 400 });
  }

  try {
    const updatedEntry = await assignSubstitute(entryId, substituteTeacherId, leaveId);
    return NextResponse.json(updatedEntry);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to assign substitute" },
      { status: 400 }
    );
  }
}
