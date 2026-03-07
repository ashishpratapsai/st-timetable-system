import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { pin } = await req.json();
  if (!pin) {
    return NextResponse.json(
      { valid: false, error: "PIN is required" },
      { status: 400 }
    );
  }

  const payrollPin = await prisma.payrollPin.findFirst();
  if (!payrollPin) {
    return NextResponse.json(
      { valid: false, error: "No PIN has been set up" },
      { status: 404 }
    );
  }

  const isValid = await bcrypt.compare(pin, payrollPin.pinHash);
  if (!isValid) {
    return NextResponse.json({ valid: false, error: "Invalid PIN" });
  }

  // Create a simple token: base64 encoded JSON with 2 hour expiry
  const tokenData = {
    verified: true,
    exp: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
  };
  const token = Buffer.from(JSON.stringify(tokenData)).toString("base64");

  return NextResponse.json({ valid: true, token });
}
