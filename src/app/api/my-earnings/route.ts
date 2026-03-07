import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/utils";

function getDateForDayOfWeek(weekStart: Date, dayOfWeek: number): Date {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayOfWeek);
  return date;
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours, minutes };
}

function computeHours(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  return (endMinutes - startMinutes) / 60;
}

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  // Find the teacher record for the current user
  const teacher = await prisma.teacher.findUnique({
    where: { userId: session!.user.id },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  if (!teacher) {
    return NextResponse.json(
      { error: "Teacher record not found" },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to dates are required" },
      { status: 400 }
    );
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Adjust the weekStart query range (weekStart can be up to 6 days before actual date)
  const adjustedFrom = new Date(fromDate);
  adjustedFrom.setDate(adjustedFrom.getDate() - 6);

  const entries = await prisma.timetableEntry.findMany({
    where: {
      teacherId: teacher.id,
      weekStart: {
        gte: adjustedFrom,
        lte: toDate,
      },
      status: { not: "CANCELLED" },
    },
    include: {
      subject: { select: { name: true, code: true } },
      batch: { select: { name: true } },
    },
    orderBy: [{ weekStart: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  // Filter entries whose actual date falls within from/to
  const filteredEntries = entries.filter((entry) => {
    const actualDate = getDateForDayOfWeek(
      new Date(entry.weekStart),
      entry.dayOfWeek
    );
    return actualDate >= fromDate && actualDate <= toDate;
  });

  // Handle combined entries (count only once per time slot)
  const combinedSlotKeys = new Set<string>();
  const uniqueEntries = filteredEntries.filter((entry) => {
    if (entry.combinedBatchId) {
      const key = `${entry.teacherId}-${entry.weekStart.toISOString()}-${entry.dayOfWeek}-${entry.startTime}-${entry.endTime}`;
      if (combinedSlotKeys.has(key)) {
        return false;
      }
      combinedSlotKeys.add(key);
    }
    return true;
  });

  // Build daily breakdown
  const dailyMap = new Map<
    string,
    {
      date: string;
      dayOfWeek: number;
      classes: number;
      hours: number;
      classTypes: Record<string, number>;
      entries: Array<{
        startTime: string;
        endTime: string;
        subject: string;
        batch: string;
        classType: string;
      }>;
    }
  >();

  let totalHours = 0;

  for (const entry of uniqueEntries) {
    const actualDate = getDateForDayOfWeek(
      new Date(entry.weekStart),
      entry.dayOfWeek
    );
    const dateKey = actualDate.toISOString().split("T")[0];
    const hours = computeHours(entry.startTime, entry.endTime);
    totalHours += hours;

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        date: dateKey,
        dayOfWeek: entry.dayOfWeek,
        classes: 0,
        hours: 0,
        classTypes: {},
        entries: [],
      });
    }

    const day = dailyMap.get(dateKey)!;
    day.classes += 1;
    day.hours += hours;

    const classType = entry.classType || "ACTUAL";
    day.classTypes[classType] = (day.classTypes[classType] || 0) + 1;

    day.entries.push({
      startTime: entry.startTime,
      endTime: entry.endTime,
      subject: entry.subject.name,
      batch: entry.batch.name,
      classType,
    });
  }

  const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const totalEarned =
    Math.round(totalHours * (teacher.hourlyRate || 0) * 100) / 100;

  return NextResponse.json({
    teacherId: teacher.id,
    teacherName: teacher.user.name,
    hourlyRate: teacher.hourlyRate || 0,
    totalHours: Math.round(totalHours * 100) / 100,
    totalEarned,
    dailyBreakdown,
  });
}
