import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  return { error: null, session };
}

export async function requireAdmin() {
  const { error, session } = await requireAuth();
  if (error) return { error, session: null };
  if (session!.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }), session: null };
  }
  return { error: null, session: session! };
}

export function formatBatchType(type: string) {
  const map: Record<string, string> = {
    IIT_JEE: "IIT-JEE",
    NEET: "NEET",
    JEE_MAINS: "JEE Mains",
    SCHOOL_8TH: "8th Standard",
    SCHOOL_9TH: "9th Standard",
    SCHOOL_10TH: "10th Standard",
  };
  return map[type] || type;
}

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
