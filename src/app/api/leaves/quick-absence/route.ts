import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";
import { findSubstitutesForLeave, assignSubstitute } from "@/lib/ai/substitute-finder";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { teacherId, date, reason } = body;

  if (!teacherId || !date) {
    return NextResponse.json({ error: "teacherId and date are required" }, { status: 400 });
  }

  const absenceDate = new Date(date);

  try {
    // Step 1: Create auto-approved leave
    const leave = await prisma.leave.create({
      data: {
        teacherId,
        leaveType: "EMERGENCY",
        startDate: absenceDate,
        endDate: absenceDate,
        reason: reason || "Quick absence - auto-approved",
        status: "APPROVED",
        approvedBy: session!.user.id,
      },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
      },
    });

    // Step 2: Find affected entries and AI suggestions
    const substituteData = await findSubstitutesForLeave(leave.id);

    // Step 3: Auto-assign best substitute for each entry
    const substitutions: Array<{
      entryId: string;
      subject: string;
      batch: string;
      time: string;
      substituteTeacher: string | null;
      status: "assigned" | "failed" | "no_suggestion";
      error?: string;
    }> = [];

    for (const entry of substituteData.affectedEntries) {
      const suggestion = substituteData.aiSuggestions?.find((s) => s.entryId === entry.id);

      if (!suggestion) {
        substitutions.push({
          entryId: entry.id,
          subject: entry.subject.name,
          batch: entry.batch.name,
          time: `Day ${entry.dayOfWeek} ${entry.startTime}-${entry.endTime}`,
          substituteTeacher: null,
          status: "no_suggestion",
        });
        continue;
      }

      try {
        const updated = await assignSubstitute(entry.id, suggestion.substituteTeacherId, leave.id);
        substitutions.push({
          entryId: entry.id,
          subject: entry.subject.name,
          batch: entry.batch.name,
          time: `Day ${entry.dayOfWeek} ${entry.startTime}-${entry.endTime}`,
          substituteTeacher: updated.substituteTeacher?.user.name || null,
          status: "assigned",
        });
      } catch (assignErr) {
        substitutions.push({
          entryId: entry.id,
          subject: entry.subject.name,
          batch: entry.batch.name,
          time: `Day ${entry.dayOfWeek} ${entry.startTime}-${entry.endTime}`,
          substituteTeacher: null,
          status: "failed",
          error: assignErr instanceof Error ? assignErr.message : "Unknown error",
        });
      }
    }

    const assigned = substitutions.filter((s) => s.status === "assigned").length;
    const failed = substitutions.filter((s) => s.status !== "assigned").length;

    return NextResponse.json({
      leave,
      totalAffected: substituteData.affectedEntries.length,
      assigned,
      failed,
      substitutions,
      message: failed === 0
        ? `All ${assigned} classes covered with substitutes`
        : `${assigned} classes covered, ${failed} need manual assignment`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Quick absence failed" },
      { status: 500 }
    );
  }
}
