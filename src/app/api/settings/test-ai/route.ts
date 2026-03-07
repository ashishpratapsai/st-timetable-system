import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/utils";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  const providerSetting = await prisma.settings.findUnique({
    where: { key: "ai_provider" },
  });
  const provider = providerSetting?.value || "claude";

  const keyName = provider === "gemini" ? "gemini_api_key" : "claude_api_key";
  const setting = await prisma.settings.findUnique({
    where: { key: keyName },
  });

  if (!setting) {
    const label = provider === "gemini" ? "Gemini" : "Claude";
    return NextResponse.json({ success: false, message: `No ${label} API key configured` });
  }

  try {
    if (provider === "gemini") {
      const genAI = new GoogleGenerativeAI(setting.value);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent("Say 'Connection successful!' in exactly those words.");
      const text = result.response.text();
      return NextResponse.json({ success: true, message: `Gemini connected! Response: ${text}` });
    } else {
      const client = new Anthropic({ apiKey: setting.value });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 50,
        messages: [{ role: "user", content: "Say 'Connection successful!' in exactly those words." }],
      });
      const text = response.content[0].type === "text" ? response.content[0].text : "";
      return NextResponse.json({ success: true, message: `Claude connected! Response: ${text}` });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, message: `Connection failed: ${message}` });
  }
}
