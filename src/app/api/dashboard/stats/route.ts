import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [totalCenters, totalTeachers, totalBatches, totalClassrooms, pendingLeaves] =
    await Promise.all([
      prisma.center.count(),
      prisma.teacher.count(),
      prisma.batch.count({ where: { status: "ACTIVE" } }),
      prisma.classroom.count(),
      prisma.leave.count({ where: { status: "PENDING" } }),
    ]);

  // Count today's classes
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1; // Convert to Mon=0
  const todayClasses = await prisma.timetableEntry.count({
    where: {
      dayOfWeek,
      status: "SCHEDULED",
    },
  });

  return NextResponse.json({
    totalCenters,
    totalTeachers,
    totalBatches,
    totalClassrooms,
    pendingLeaves,
    todayClasses,
  });
}
