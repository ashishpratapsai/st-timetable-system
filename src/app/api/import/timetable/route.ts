import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

function parseCSV(text: string): string[][] {
  const lines = text.trim().split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => line.split(",").map((cell) => cell.trim()));
}

const DAY_NAME_MAP: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

function parseDayOfWeek(value: string): number | null {
  const lower = value.toLowerCase();
  if (DAY_NAME_MAP[lower] !== undefined) return DAY_NAME_MAP[lower];
  const num = parseInt(value, 10);
  if (!isNaN(num) && num >= 0 && num <= 6) return num;
  return null;
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const csvText = await req.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    const headers = rows[0].map((h) => h.toLowerCase().trim());
    const batchNameIdx = headers.indexOf("batchname");
    const subjectCodeIdx = headers.indexOf("subjectcode");
    const teacherEmailIdx = headers.indexOf("teacheremail");
    const classroomNameIdx = headers.indexOf("classroomname");
    const dayOfWeekIdx = headers.indexOf("dayofweek");
    const startTimeIdx = headers.indexOf("starttime");
    const endTimeIdx = headers.indexOf("endtime");
    const classTypeIdx = headers.indexOf("classtype");
    const weekStartIdx = headers.indexOf("weekstart");

    if (batchNameIdx === -1 || subjectCodeIdx === -1 || teacherEmailIdx === -1 ||
        classroomNameIdx === -1 || dayOfWeekIdx === -1 || startTimeIdx === -1 ||
        endTimeIdx === -1 || weekStartIdx === -1) {
      return NextResponse.json(
        { error: "CSV must have columns: batchName, subjectCode, teacherEmail, classroomName, dayOfWeek, startTime, endTime, weekStart" },
        { status: 400 }
      );
    }

    // Build lookup maps
    const allUsers = await prisma.user.findMany({
      where: { role: "TEACHER" },
      include: { teacher: true },
    });
    const teacherByEmail: Record<string, string> = {};
    for (const u of allUsers) {
      if (u.teacher) {
        teacherByEmail[u.email.toLowerCase()] = u.teacher.id;
      }
    }

    const allBatches = await prisma.batch.findMany();
    const batchByName: Record<string, string> = {};
    for (const b of allBatches) {
      batchByName[b.name.toLowerCase()] = b.id;
    }

    const allSubjects = await prisma.subject.findMany();
    const subjectByCode: Record<string, string> = {};
    for (const s of allSubjects) {
      subjectByCode[s.code.toUpperCase()] = s.id;
    }

    const allClassrooms = await prisma.classroom.findMany();
    const classroomByName: Record<string, string> = {};
    for (const c of allClassrooms) {
      classroomByName[c.name.toLowerCase()] = c.id;
    }

    let imported = 0;
    const errors: { row: number; message: string }[] = [];

    // Track bookings within this import batch for conflict detection
    const teacherBookings: Set<string> = new Set();
    const classroomBookings: Set<string> = new Set();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        const batchName = row[batchNameIdx] || "";
        const subjectCode = (row[subjectCodeIdx] || "").toUpperCase();
        const teacherEmail = (row[teacherEmailIdx] || "").toLowerCase();
        const classroomName = row[classroomNameIdx] || "";
        const dayOfWeekRaw = row[dayOfWeekIdx] || "";
        const startTime = row[startTimeIdx] || "";
        const endTime = row[endTimeIdx] || "";
        const classType = classTypeIdx !== -1 && row[classTypeIdx]
          ? row[classTypeIdx].toUpperCase()
          : "ACTUAL";
        const weekStart = row[weekStartIdx] || "";

        if (!batchName || !subjectCode || !teacherEmail || !classroomName ||
            !dayOfWeekRaw || !startTime || !endTime || !weekStart) {
          errors.push({ row: rowNum, message: "All required fields must be filled" });
          continue;
        }

        const dayOfWeek = parseDayOfWeek(dayOfWeekRaw);
        if (dayOfWeek === null) {
          errors.push({ row: rowNum, message: `Invalid dayOfWeek '${dayOfWeekRaw}'. Use 0-6 or Monday-Sunday` });
          continue;
        }

        // Validate classType
        if (!["ACTUAL", "REVISION", "DOUBT"].includes(classType)) {
          errors.push({ row: rowNum, message: `Invalid classType '${classType}'. Use ACTUAL, REVISION, or DOUBT` });
          continue;
        }

        const teacherId = teacherByEmail[teacherEmail];
        if (!teacherId) {
          errors.push({ row: rowNum, message: `Teacher with email '${teacherEmail}' not found` });
          continue;
        }

        const batchId = batchByName[batchName.toLowerCase()];
        if (!batchId) {
          errors.push({ row: rowNum, message: `Batch '${batchName}' not found` });
          continue;
        }

        const subjectId = subjectByCode[subjectCode];
        if (!subjectId) {
          errors.push({ row: rowNum, message: `Subject with code '${subjectCode}' not found` });
          continue;
        }

        const classroomId = classroomByName[classroomName.toLowerCase()];
        if (!classroomId) {
          errors.push({ row: rowNum, message: `Classroom '${classroomName}' not found` });
          continue;
        }

        const weekDate = new Date(weekStart);
        if (isNaN(weekDate.getTime())) {
          errors.push({ row: rowNum, message: `Invalid weekStart date '${weekStart}'` });
          continue;
        }

        // Build booking keys for conflict detection
        const teacherKey = `${teacherId}-${dayOfWeek}-${startTime}-${weekStart}`;
        const classroomKey = `${classroomId}-${dayOfWeek}-${startTime}-${weekStart}`;

        // Check within this import batch
        if (teacherBookings.has(teacherKey)) {
          errors.push({ row: rowNum, message: `Teacher double-booking conflict within this CSV (same day/time/week)` });
          continue;
        }
        if (classroomBookings.has(classroomKey)) {
          errors.push({ row: rowNum, message: `Classroom double-booking conflict within this CSV (same day/time/week)` });
          continue;
        }

        // Check against existing database entries
        const teacherConflict = await prisma.timetableEntry.findFirst({
          where: {
            teacherId,
            dayOfWeek,
            startTime,
            weekStart: weekDate,
            status: { in: ["SCHEDULED", "SUBSTITUTED"] },
          },
        });
        if (teacherConflict) {
          errors.push({ row: rowNum, message: `Teacher is already booked at this time in existing timetable` });
          continue;
        }

        const roomConflict = await prisma.timetableEntry.findFirst({
          where: {
            classroomId,
            dayOfWeek,
            startTime,
            weekStart: weekDate,
            status: { in: ["SCHEDULED", "SUBSTITUTED"] },
          },
        });
        if (roomConflict) {
          errors.push({ row: rowNum, message: `Classroom is already booked at this time in existing timetable` });
          continue;
        }

        await prisma.timetableEntry.create({
          data: {
            batchId,
            subjectId,
            teacherId,
            classroomId,
            dayOfWeek,
            startTime,
            endTime,
            weekStart: weekDate,
            status: "SCHEDULED",
            classType: classType as "ACTUAL" | "REVISION" | "DOUBT",
          },
        });

        // Record this booking for intra-CSV conflict checks
        teacherBookings.add(teacherKey);
        classroomBookings.add(classroomKey);

        imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push({ row: rowNum, message });
      }
    }

    return NextResponse.json({ imported, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process CSV";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
