import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth, getSlotDurationHours } from "@/lib/utils";
import { hash } from "bcryptjs";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const teachers = await prisma.teacher.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      subjects: { include: { subject: true } },
      availability: { where: { isAvailable: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      _count: { select: { timetableEntries: true, leaves: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  // Add availability summary to each teacher
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const teachersWithSummary = teachers.map((t) => {
    const availDays = new Set(t.availability.map((a) => a.dayOfWeek));
    const totalSlots = t.availability.length;
    const totalHours = t.availability.reduce(
      (sum, a) => sum + getSlotDurationHours(a.startTime, a.endTime), 0
    );
    return {
      ...t,
      availabilitySummary: {
        days: Array.from(availDays).sort().map((d) => DAYS[d]),
        totalSlots,
        totalHours: Math.round(totalHours * 10) / 10,
      },
    };
  });

  return NextResponse.json(teachersWithSummary);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { name, email, phone, password, shortCode, employmentType, subjectIds } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 400 });
  }

  const hashedPassword = await hash(password || "teacher123", 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword,
      role: "TEACHER",
      teacher: {
        create: {
          shortCode: shortCode || null,
          employmentType: employmentType || "FULL_TIME",
          subjects: {
            create: (subjectIds || []).map((subjectId: string) => ({
              subjectId,
            })),
          },
        },
      },
    },
    include: {
      teacher: {
        include: {
          subjects: { include: { subject: true } },
        },
      },
    },
  });

  return NextResponse.json(user, { status: 201 });
}
