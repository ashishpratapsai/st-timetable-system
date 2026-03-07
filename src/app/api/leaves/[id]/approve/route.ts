import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";
import { findSubstitutesForLeave } from "@/lib/ai/substitute-finder";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { status } = body; // "APPROVED" or "REJECTED"

  const leave = await prisma.leave.update({
    where: { id },
    data: {
      status,
      approvedBy: session!.user.id,
    },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
    },
  });

  // If approved, auto-trigger substitute finding
  let substituteData = null;
  if (status === "APPROVED") {
    try {
      substituteData = await findSubstitutesForLeave(id);
    } catch {
      // Substitute finding failed, return leave without suggestions
    }
  }

  return NextResponse.json({ leave, substituteData });
}
