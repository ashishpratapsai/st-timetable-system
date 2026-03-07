import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const settings = await prisma.settings.findMany();
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value;
  }

  // Mask API keys
  if (settingsMap.claude_api_key) {
    const key = settingsMap.claude_api_key;
    settingsMap.claude_api_key_masked = key.slice(0, 8) + "..." + key.slice(-4);
    settingsMap.has_api_key = "true";
    delete settingsMap.claude_api_key;
  }
  if (settingsMap.gemini_api_key) {
    const key = settingsMap.gemini_api_key;
    settingsMap.gemini_api_key_masked = key.slice(0, 8) + "..." + key.slice(-4);
    settingsMap.has_gemini_key = "true";
    delete settingsMap.gemini_api_key;
  }

  return NextResponse.json(settingsMap);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { key, value } = body;

  await prisma.settings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  return NextResponse.json({ success: true });
}
