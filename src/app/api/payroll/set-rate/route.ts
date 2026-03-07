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

export async function PUT(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  if (!verifyPayrollToken(req)) {
    return NextResponse.json(
      { error: "Invalid or expired payroll token" },
      { status: 403 }
    );
  }

  const { teacherId, hourlyRate } = await req.json();

  if (!teacherId || hourlyRate === undefined || hourlyRate === null) {
    return NextResponse.json(
      { error: "teacherId and hourlyRate are required" },
      { status: 400 }
    );
  }

  if (typeof hourlyRate !== "number" || hourlyRate < 0) {
    return NextResponse.json(
      { error: "hourlyRate must be a non-negative number" },
      { status: 400 }
    );
  }

  const teacher = await prisma.teacher.update({
    where: { id: teacherId },
    data: { hourlyRate },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(teacher);
}
