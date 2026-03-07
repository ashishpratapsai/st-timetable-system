import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

function parseCSV(text: string): string[][] {
  const lines = text.trim().split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => line.split(",").map((cell) => cell.trim()));
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
    const teacherEmailIdx = headers.indexOf("teacheremail");
    const batchNameIdx = headers.indexOf("batchname");
    const subjectCodeIdx = headers.indexOf("subjectcode");
    const totalHoursIdx = headers.indexOf("totalhours");
    const startDateIdx = headers.indexOf("startdate");
    const endDateIdx = headers.indexOf("enddate");

    if (teacherEmailIdx === -1 || batchNameIdx === -1 || subjectCodeIdx === -1 ||
        totalHoursIdx === -1 || startDateIdx === -1 || endDateIdx === -1) {
      return NextResponse.json(
        { error: "CSV must have columns: teacherEmail, batchName, subjectCode, totalHours, startDate, endDate" },
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

    let imported = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        const teacherEmail = (row[teacherEmailIdx] || "").toLowerCase();
        const batchName = row[batchNameIdx] || "";
        const subjectCode = (row[subjectCodeIdx] || "").toUpperCase();
        const totalHours = parseInt(row[totalHoursIdx] || "0", 10);
        const startDate = row[startDateIdx] || "";
        const endDate = row[endDateIdx] || "";

        if (!teacherEmail || !batchName || !subjectCode || !totalHours || !startDate || !endDate) {
          errors.push({ row: rowNum, message: "All fields are required" });
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

        // Check for duplicate
        const existing = await prisma.teachingAssignment.findUnique({
          where: { teacherId_batchId_subjectId: { teacherId, batchId, subjectId } },
        });
        if (existing) {
          errors.push({ row: rowNum, message: `Assignment already exists for this teacher-batch-subject — skipped` });
          continue;
        }

        await prisma.teachingAssignment.create({
          data: {
            teacherId,
            batchId,
            subjectId,
            totalHours,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
          },
        });

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
