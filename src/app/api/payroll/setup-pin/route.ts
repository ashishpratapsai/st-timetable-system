import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { pin } = await req.json();
  if (!pin || pin.length < 4) {
    return NextResponse.json(
      { error: "PIN must be at least 4 digits" },
      { status: 400 }
    );
  }

  const pinHash = await bcrypt.hash(pin, 10);

  // Upsert - delete existing and create new
  await prisma.payrollPin.deleteMany();
  await prisma.payrollPin.create({ data: { pinHash } });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const pin = await prisma.payrollPin.findFirst();
  return NextResponse.json({ exists: !!pin });
}
