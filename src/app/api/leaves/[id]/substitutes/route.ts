import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/utils";
import { findSubstitutesForLeave } from "@/lib/ai/substitute-finder";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    const result = await findSubstitutesForLeave(id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to find substitutes" },
      { status: 500 }
    );
  }
}
