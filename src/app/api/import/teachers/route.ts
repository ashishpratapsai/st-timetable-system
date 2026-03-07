import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";
import bcrypt from "bcryptjs";

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
    const nameIdx = headers.indexOf("name");
    const emailIdx = headers.indexOf("email");
    const phoneIdx = headers.indexOf("phone");
    const employmentTypeIdx = headers.indexOf("employmenttype");
    const shortCodeIdx = headers.indexOf("shortcode");
    const hourlyRateIdx = headers.indexOf("hourlyrate");
    const subjectsIdx = headers.indexOf("subjects");

    if (nameIdx === -1 || emailIdx === -1) {
      return NextResponse.json(
        { error: "CSV must have 'name' and 'email' columns" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash("teacher123", 12);

    // Fetch all subjects once for lookups
    const allSubjects = await prisma.subject.findMany();
    const subjectByCode: Record<string, string> = {};
    for (const s of allSubjects) {
      subjectByCode[s.code.toUpperCase()] = s.id;
    }

    let imported = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1; // 1-indexed for user display

      try {
        const name = row[nameIdx] || "";
        const email = row[emailIdx] || "";

        if (!name || !email) {
          errors.push({ row: rowNum, message: "Name and email are required" });
          continue;
        }

        // Check if user already exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          errors.push({ row: rowNum, message: `Email '${email}' already exists — skipped` });
          continue;
        }

        const phone = phoneIdx !== -1 ? row[phoneIdx] || null : null;
        const employmentType = employmentTypeIdx !== -1 && row[employmentTypeIdx]
          ? (row[employmentTypeIdx].toUpperCase() === "PART_TIME" ? "PART_TIME" : "FULL_TIME")
          : "FULL_TIME";
        const shortCode = shortCodeIdx !== -1 ? row[shortCodeIdx] || null : null;
        const hourlyRate = hourlyRateIdx !== -1 && row[hourlyRateIdx]
          ? parseFloat(row[hourlyRateIdx])
          : null;

        // Parse subject codes — everything from the subjects column index onward
        // handles both "PHY,MAT" in one column and PHY,MAT spread across columns
        const subjectCodes: string[] = [];
        if (subjectsIdx !== -1) {
          for (let j = subjectsIdx; j < row.length; j++) {
            const code = row[j]?.trim().toUpperCase();
            if (code && subjectByCode[code]) {
              subjectCodes.push(code);
            }
          }
        }

        const subjectCreates = subjectCodes
          .map((code) => subjectByCode[code])
          .filter(Boolean)
          .map((subjectId) => ({ subjectId }));

        await prisma.user.create({
          data: {
            name,
            email,
            phone,
            password: hashedPassword,
            role: "TEACHER",
            teacher: {
              create: {
                shortCode,
                employmentType: employmentType as "FULL_TIME" | "PART_TIME",
                hourlyRate,
                subjects: {
                  create: subjectCreates,
                },
              },
            },
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
