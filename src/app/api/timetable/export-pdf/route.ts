import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ENTRY_INCLUDE = {
  batch: { select: { id: true, name: true, batchType: true } },
  subject: { select: { id: true, name: true, code: true } },
  teacher: { include: { user: { select: { name: true } } } },
  substituteTeacher: { include: { user: { select: { name: true } } } },
  classroom: { include: { center: { select: { name: true } } } },
};

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const weekStart = req.nextUrl.searchParams.get("weekStart");
  const teacherId = req.nextUrl.searchParams.get("teacherId");
  const centerId = req.nextUrl.searchParams.get("centerId");

  if (!weekStart) {
    return new Response(JSON.stringify({ error: "weekStart is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const where: Record<string, unknown> = {
    weekStart: new Date(weekStart),
  };
  if (centerId) where.classroom = { centerId };
  if (teacherId) where.teacherId = teacherId;

  const [entries, timeSlots, teachers, centers] = await Promise.all([
    prisma.timetableEntry.findMany({
      where,
      include: ENTRY_INCLUDE,
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.timeSlot.findMany({ orderBy: { order: "asc" } }),
    teacherId
      ? prisma.teacher.findMany({
          where: { id: teacherId },
          include: { user: { select: { name: true } } },
        })
      : Promise.resolve([]),
    centerId
      ? prisma.center.findMany({ where: { id: centerId } })
      : Promise.resolve([]),
  ]);

  // Build subtitle
  let subtitle = "All";
  if (teacherId && teachers.length > 0) {
    subtitle = teachers[0].user.name;
  } else if (centerId && centers.length > 0) {
    subtitle = centers[0].name;
  }

  // Format week label
  const weekDate = new Date(weekStart);
  const weekLabel = weekDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build lookup: day -> startTime -> entries
  const entryMap: Record<string, Record<string, typeof entries>> = {};
  for (const entry of entries) {
    const dayKey = String(entry.dayOfWeek);
    if (!entryMap[dayKey]) entryMap[dayKey] = {};
    if (!entryMap[dayKey][entry.startTime]) entryMap[dayKey][entry.startTime] = [];
    entryMap[dayKey][entry.startTime].push(entry);
  }

  // Build table data
  const headers = ["Time", ...DAYS];
  const rows: string[][] = [];

  for (const slot of timeSlots) {
    const row: string[] = [`${slot.startTime}-${slot.endTime}`];

    for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
      const dayEntries = entryMap[String(dayIndex)]?.[slot.startTime] || [];

      if (dayEntries.length === 0) {
        row.push("");
      } else {
        const cellParts = dayEntries.map((e) => {
          const classType = (e as Record<string, unknown>).classType as string | undefined;
          let subjectCode = e.subject.code;
          if (classType === "REVISION") subjectCode += " (R)";
          if (classType === "DOUBT") subjectCode += " (D)";

          if (e.status === "CANCELLED") {
            return `CANCELLED\n${subjectCode}\n${e.batch.name}`;
          }

          let teacherLine: string;
          if (teacherId) {
            // When filtered by teacher, show room instead
            teacherLine = e.classroom.name;
          } else {
            teacherLine = e.teacher.user.name;
          }

          if (e.status === "SUBSTITUTED" && e.substituteTeacher) {
            teacherLine = `Sub: ${e.substituteTeacher.user.name}`;
          }

          return `${subjectCode}\n${e.batch.name}\n${teacherLine}`;
        });

        row.push(cellParts.join("\n---\n"));
      }
    }
    rows.push(row);
  }

  // Generate PDF
  const doc = new jsPDF({ orientation: "landscape" });

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("School Toppers \u2014 Weekly Timetable", 14, 15);

  // Subtitle
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, 14, 23);

  // Week
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Week of ${weekLabel}`, 14, 30);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 36,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    theme: "grid",
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
    },
    didParseCell: (data) => {
      // Color CANCELLED cells
      if (data.section === "body" && data.cell.raw && typeof data.cell.raw === "string") {
        if (data.cell.raw.includes("CANCELLED")) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "italic";
        } else if (data.cell.raw.includes("Sub:")) {
          data.cell.styles.fillColor = [255, 251, 235];
        }
      }
    },
  });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="timetable-${weekStart}.pdf"`,
    },
  });
}
