import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

function verifyPayrollToken(req: NextRequest): boolean {
  const token = req.headers.get("x-payroll-token");
  if (!token) return false;

  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    if (!decoded.verified || !decoded.exp) return false;
    if (Date.now() > decoded.exp) return false;
    return true;
  } catch {
    return false;
  }
}

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
  const { error } = await requireAdmin();
  if (error) return error;

  if (!verifyPayrollToken(req)) {
    return NextResponse.json(
      { error: "Invalid or expired payroll token" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const teacherIdFilter = searchParams.get("teacherId");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to dates are required" },
      { status: 400 }
    );
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Find all timetable entries where weekStart falls within a range
  // that could produce dates in our from/to range
  // A weekStart can be up to 6 days before the actual class date
  const adjustedFrom = new Date(fromDate);
  adjustedFrom.setDate(adjustedFrom.getDate() - 6);

  const whereClause: Record<string, unknown> = {
    weekStart: {
      gte: adjustedFrom,
      lte: toDate,
    },
    status: { not: "CANCELLED" },
  };

  if (teacherIdFilter) {
    whereClause.teacherId = teacherIdFilter;
  }

  const entries = await prisma.timetableEntry.findMany({
    where: whereClause,
    include: {
      teacher: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
      subject: { select: { name: true, code: true } },
      batch: { select: { name: true } },
    },
  });

  // Filter entries whose actual date (weekStart + dayOfWeek) falls within from/to
  const filteredEntries = entries.filter((entry) => {
    const actualDate = getDateForDayOfWeek(
      new Date(entry.weekStart),
      entry.dayOfWeek
    );
    return actualDate >= fromDate && actualDate <= toDate;
  });

  // Track combined entries to avoid double-counting
  // For combined entries, group by teacherId + weekStart + dayOfWeek + startTime + endTime
  // and count only once
  const combinedSlotKeys = new Set<string>();
  const uniqueEntries = filteredEntries.filter((entry) => {
    if (entry.combinedBatchId) {
      const key = `${entry.teacherId}-${entry.weekStart.toISOString()}-${entry.dayOfWeek}-${entry.startTime}-${entry.endTime}`;
      if (combinedSlotKeys.has(key)) {
        return false; // Skip duplicate combined entry
      }
      combinedSlotKeys.add(key);
    }
    return true;
  });

  // Group by teacher
  const teacherMap = new Map<
    string,
    {
      teacherId: string;
      teacherName: string;
      teacherEmail: string;
      hourlyRate: number;
      shortCode: string | null;
      totalHours: number;
      classBreakdown: Record<string, number>;
      combinedCount: number;
      entries: Array<{
        date: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        subject: string;
        batch: string;
        classType: string;
        hours: number;
        isCombined: boolean;
      }>;
    }
  >();

  for (const entry of uniqueEntries) {
    const tid = entry.teacherId;
    if (!teacherMap.has(tid)) {
      teacherMap.set(tid, {
        teacherId: tid,
        teacherName: entry.teacher.user.name,
        teacherEmail: entry.teacher.user.email,
        hourlyRate: entry.teacher.hourlyRate || 0,
        shortCode: entry.teacher.shortCode,
        totalHours: 0,
        classBreakdown: {},
        combinedCount: 0,
        entries: [],
      });
    }

    const record = teacherMap.get(tid)!;
    const hours = computeHours(entry.startTime, entry.endTime);
    record.totalHours += hours;

    // Class type breakdown
    const classType = entry.classType || "ACTUAL";
    record.classBreakdown[classType] =
      (record.classBreakdown[classType] || 0) + 1;

    if (entry.combinedBatchId) {
      record.combinedCount += 1;
    }

    const actualDate = getDateForDayOfWeek(
      new Date(entry.weekStart),
      entry.dayOfWeek
    );
    record.entries.push({
      date: actualDate.toISOString().split("T")[0],
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      subject: entry.subject.name,
      batch: entry.batch.name,
      classType,
      hours,
      isCombined: !!entry.combinedBatchId,
    });
  }

  // Build response array
  const payrollRecords = Array.from(teacherMap.values()).map((record) => ({
    teacherId: record.teacherId,
    teacherName: record.teacherName,
    teacherEmail: record.teacherEmail,
    shortCode: record.shortCode,
    hourlyRate: record.hourlyRate,
    totalHours: Math.round(record.totalHours * 100) / 100,
    earned: Math.round(record.totalHours * record.hourlyRate * 100) / 100,
    classBreakdown: record.classBreakdown,
    combinedCount: record.combinedCount,
    entries: record.entries.sort(
      (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
    ),
  }));

  // Sort by teacher name
  payrollRecords.sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  return NextResponse.json(payrollRecords);
}
