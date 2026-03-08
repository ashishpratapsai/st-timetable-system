import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, getSlotDurationHours } from "@/lib/utils";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const teachers = await prisma.teacher.findMany({
    include: {
      user: { select: { name: true } },
      timetableEntries: {
        where: { status: "SCHEDULED" },
        select: { startTime: true, endTime: true },
      },
      leaves: true,
    },
  });

  const utilization = teachers.map((t) => ({
    name: t.user.name,
    scheduledHours: Math.round(
      t.timetableEntries.reduce(
        (sum, e) => sum + getSlotDurationHours(e.startTime, e.endTime), 0
      ) * 10
    ) / 10,
    totalLeaves: t.leaves.length,
    pendingLeaves: t.leaves.filter((l) => l.status === "PENDING").length,
  }));

  // Sort by scheduled hours descending
  utilization.sort((a, b) => b.scheduledHours - a.scheduledHours);

  return NextResponse.json(utilization);
}
