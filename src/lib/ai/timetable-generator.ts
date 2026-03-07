import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/db";

interface GeneratedEntry {
  batchId: string;
  subjectId: string;
  teacherId: string;
  classroomId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface GenerationResult {
  entries: GeneratedEntry[];
  conflicts: string[];
  message: string;
}

async function getAIProvider(): Promise<{
  provider: "claude" | "gemini";
  apiKey: string;
}> {
  const providerSetting = await prisma.settings.findUnique({
    where: { key: "ai_provider" },
  });

  const provider = (providerSetting?.value as "claude" | "gemini") || "claude";

  const keyName = provider === "gemini" ? "gemini_api_key" : "claude_api_key";
  const keySetting = await prisma.settings.findUnique({
    where: { key: keyName },
  });

  if (!keySetting) {
    const label = provider === "gemini" ? "Gemini" : "Claude";
    throw new Error(`${label} API key not configured. Go to Settings to add it.`);
  }

  return { provider, apiKey: keySetting.value };
}

async function callClaude(prompt: string, apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    messages: [
      { role: "user", content: prompt },
      { role: "assistant", content: "[" },
    ],
  });

  let text = response.content[0].type === "text" ? response.content[0].text : "";
  return "[" + text;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 16384,
    },
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

function parseJSON(text: string): GeneratedEntry[] {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // continue
  }

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // continue
  }

  // Truncated response — close the array
  try {
    const trimmed = text.replace(/,\s*$/, "");
    const lastBrace = trimmed.lastIndexOf("}");
    if (lastBrace > 0) {
      return JSON.parse(trimmed.substring(0, lastBrace + 1) + "]");
    }
  } catch {
    // continue
  }

  console.error("AI parse fail (first 500):", text.substring(0, 500));
  throw new Error("Failed to parse AI response as JSON");
}

/**
 * Build prompt for a SINGLE center's batches.
 * Keeps prompt small so output stays within token limits.
 */
function buildPromptForCenter(
  centerBatches: { id: string; name: string; center: string; strength: number; subjects: { id: string; hpw: number }[] }[],
  centerClassrooms: { id: string; name: string; cap: number }[],
  relevantTeachers: { id: string; name: string; type: string; subjects: string[]; unavailable: string[] }[],
  centerAssignments: { t: string; b: string; s: string; slots: number }[],
  slotData: { start: string; end: string }[],
  subjectList: string,
  classroomRestrictions: { room: string; day: number; start: string }[],
  teacherLeaveData: { teacher: string; days: number[] }[],
  customPrompt: string,
): string {
  const centerRestrictions = classroomRestrictions.filter((r) =>
    centerClassrooms.some((c) => c.id === r.room)
  );
  const relevantTeacherIds = new Set(relevantTeachers.map((t) => t.id));
  const centerLeaves = teacherLeaveData.filter((l) => relevantTeacherIds.has(l.teacher));

  return `Generate a weekly timetable. Output ONLY a JSON array.

SUBJECTS: ${subjectList}
TEACHERS: ${JSON.stringify(relevantTeachers)}
BATCHES: ${JSON.stringify(centerBatches)}
CLASSROOMS: ${JSON.stringify(centerClassrooms)}
SLOTS: ${JSON.stringify(slotData)}
${centerAssignments.length > 0 ? `ASSIGNMENTS (t=teacher,b=batch,s=subject,slots=perWeek): ${JSON.stringify(centerAssignments)}` : ""}
${centerRestrictions.length > 0 ? `BLOCKED: ${JSON.stringify(centerRestrictions)}` : ""}
${centerLeaves.length > 0 ? `LEAVES: ${JSON.stringify(centerLeaves)}` : ""}

DAYS: Mon=0,Tue=1,Wed=2,Thu=3,Fri=4,Sat=5

RULES:
- No teacher/classroom/batch double-booking at same day+time
- Teacher must teach subjects they're qualified for
- Assignments dictate teacher-batch-subject pairing and slots needed
- Classroom capacity >= batch strength
- Spread subjects across the week, balance teacher workload
${customPrompt ? `\nCUSTOM INSTRUCTIONS FROM ADMIN:\n${customPrompt}` : ""}

Each element: {"batchId":"...","subjectId":"...","teacherId":"...","classroomId":"...","dayOfWeek":0,"startTime":"09:00","endTime":"10:00"}
ONLY the JSON array. No text, no markdown.`;
}

export async function generateTimetable(
  centerId: string | null,
  weekStart: Date
): Promise<GenerationResult> {
  const { provider, apiKey } = await getAIProvider();

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const [teachers, batches, classrooms, timeSlots, teachingAssignments, classroomBlocks, approvedLeaves] = await Promise.all([
    prisma.teacher.findMany({
      include: {
        user: { select: { name: true } },
        subjects: { include: { subject: true } },
        availability: true,
      },
    }),
    prisma.batch.findMany({
      where: {
        status: "ACTIVE",
        ...(centerId ? { centerId } : {}),
      },
      include: {
        center: { select: { id: true, name: true } },
        batchSubjects: { include: { subject: true } },
      },
    }),
    prisma.classroom.findMany({
      where: centerId ? { centerId } : {},
      include: { center: { select: { id: true, name: true } } },
    }),
    prisma.timeSlot.findMany({ orderBy: { order: "asc" } }),
    prisma.teachingAssignment.findMany({
      where: {
        startDate: { lte: weekStart },
        endDate: { gte: weekStart },
      },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        batch: true,
        subject: true,
      },
    }),
    prisma.classroomAvailability.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
        isAvailable: false,
      },
    }),
    prisma.leave.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: weekEnd },
        endDate: { gte: weekStart },
      },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
      },
    }),
  ]);

  // Preprocess compact data
  const subjectLookup: Record<string, string> = {};
  for (const t of teachers) {
    for (const s of t.subjects) {
      subjectLookup[s.subject.id] = s.subject.code;
    }
  }
  const subjectList = Object.entries(subjectLookup).map(([id, code]) => `${id}=${code}`).join(",");

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));

  const allTeacherData = teachers.map((t) => ({
    id: t.id,
    name: t.user.name,
    type: t.employmentType,
    subjects: t.subjects.map((s) => s.subject.id),
    unavailable: t.availability.filter((a) => !a.isAvailable).map((a) => `${a.dayOfWeek}-${a.startTime}`),
  }));

  const allAssignmentData = teachingAssignments.map((a) => {
    const startDate = new Date(a.startDate);
    const endDate = new Date(a.endDate);
    const totalWeeks = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    const remainingHours = a.totalHours - a.completedHours;
    const hoursPerWeek = remainingHours / totalWeeks;
    const slotsPerWeek = Math.ceil(hoursPerWeek / 1.5);
    return { t: a.teacherId, b: a.batchId, s: a.subjectId, slots: slotsPerWeek };
  });

  const slotData = timeSlots.map((s) => ({ start: s.startTime, end: s.endTime }));

  const classroomRestrictions = classroomBlocks.map((b) => {
    const blockDate = new Date(b.date);
    const dayOfWeek = blockDate.getDay();
    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return { room: b.classroomId, day: adjustedDay, start: b.startTime };
  });

  const teacherLeaveData = approvedLeaves.map((l) => {
    const leaveDays: number[] = [];
    const start = new Date(l.startDate);
    const end = new Date(l.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const adjustedDay = day === 0 ? 6 : day - 1;
      if (adjustedDay < 6) leaveDays.push(adjustedDay);
    }
    return { teacher: l.teacherId, days: leaveDays };
  });

  // Fetch custom prompt from settings
  const customPromptSetting = await prisma.settings.findUnique({
    where: { key: "ai_custom_prompt" },
  });
  const customPrompt = customPromptSetting?.value || "";

  // ─── Split by center ───
  // Group batches by centerId
  const centerIds = [...new Set(batches.map((b) => b.centerId))];

  let allEntries: GeneratedEntry[] = [];
  const allConflicts: string[] = [];

  // Track teacher bookings across centers to avoid cross-center conflicts
  const globalTeacherSlots: Record<string, Set<string>> = {};

  for (const cid of centerIds) {
    const centerBatches = batches
      .filter((b) => b.centerId === cid)
      .map((b) => ({
        id: b.id,
        name: b.name,
        center: b.centerId,
        strength: b.strength,
        subjects: b.batchSubjects.map((bs) => ({ id: bs.subject.id, hpw: bs.hoursPerWeek })),
      }));

    const centerClassrooms = classrooms
      .filter((c) => c.centerId === cid)
      .map((c) => ({ id: c.id, name: c.name, cap: c.capacity }));

    const batchIds = new Set(centerBatches.map((b) => b.id));
    const centerAssignments = allAssignmentData.filter((a) => batchIds.has(a.b));

    // Only include teachers who have assignments at this center
    const teacherIdsForCenter = new Set(centerAssignments.map((a) => a.t));
    const centerTeachers = allTeacherData.filter((t) => teacherIdsForCenter.has(t.id));

    if (centerBatches.length === 0 || centerAssignments.length === 0) continue;

    // Add already-booked slots to teacher unavailability (from previous centers)
    const teachersWithGlobalBlocks = centerTeachers.map((t) => {
      const booked = globalTeacherSlots[t.id];
      if (!booked || booked.size === 0) return t;
      return {
        ...t,
        unavailable: [...t.unavailable, ...Array.from(booked)],
      };
    });

    const prompt = buildPromptForCenter(
      centerBatches,
      centerClassrooms,
      teachersWithGlobalBlocks,
      centerAssignments,
      slotData,
      subjectList,
      classroomRestrictions,
      teacherLeaveData,
      customPrompt,
    );

    console.log(`Generating for center ${cid}: ${centerBatches.length} batches, ${centerAssignments.length} assignments`);

    let responseText: string;
    if (provider === "gemini") {
      responseText = await callGemini(prompt, apiKey);
    } else {
      responseText = await callClaude(prompt, apiKey);
    }

    let centerEntries = parseJSON(responseText);

    // Filter invalid
    centerEntries = centerEntries.filter((e) =>
      e.batchId && e.subjectId && e.teacherId && e.classroomId &&
      typeof e.dayOfWeek === "number" && e.startTime && e.endTime
    );

    // Track teacher slots globally
    for (const entry of centerEntries) {
      const timeKey = `${entry.dayOfWeek}-${entry.startTime}`;
      if (!globalTeacherSlots[entry.teacherId]) globalTeacherSlots[entry.teacherId] = new Set();
      globalTeacherSlots[entry.teacherId].add(timeKey);
    }

    allEntries = allEntries.concat(centerEntries);
  }

  // ─── Validate all entries ───
  const teacherSlots: Record<string, Set<string>> = {};
  const classroomSlots: Record<string, Set<string>> = {};

  const teacherAvailMap: Record<string, Record<string, boolean>> = {};
  for (const t of teachers) {
    teacherAvailMap[t.id] = {};
    for (const a of t.availability) {
      teacherAvailMap[t.id][`${a.dayOfWeek}-${a.startTime}`] = a.isAvailable;
    }
  }

  for (const entry of allEntries) {
    const timeKey = `${entry.dayOfWeek}-${entry.startTime}`;

    if (!teacherSlots[entry.teacherId]) teacherSlots[entry.teacherId] = new Set();
    if (teacherSlots[entry.teacherId].has(timeKey)) {
      const t = teacherMap.get(entry.teacherId);
      allConflicts.push(`Teacher ${t?.user.name || entry.teacherId} double-booked: day ${entry.dayOfWeek}, ${entry.startTime}`);
    }
    teacherSlots[entry.teacherId].add(timeKey);

    if (!classroomSlots[entry.classroomId]) classroomSlots[entry.classroomId] = new Set();
    if (classroomSlots[entry.classroomId].has(timeKey)) {
      const room = classrooms.find((c) => c.id === entry.classroomId);
      allConflicts.push(`Classroom ${room?.name || entry.classroomId} double-booked: day ${entry.dayOfWeek}, ${entry.startTime}`);
    }
    classroomSlots[entry.classroomId].add(timeKey);

    const avail = teacherAvailMap[entry.teacherId];
    if (avail && avail[timeKey] === false) {
      const t = teacherMap.get(entry.teacherId);
      allConflicts.push(`Teacher ${t?.user.name || entry.teacherId} unavailable: day ${entry.dayOfWeek}, ${entry.startTime}`);
    }

    const teacherLeave = teacherLeaveData.find(
      (l) => l.teacher === entry.teacherId && l.days.includes(entry.dayOfWeek)
    );
    if (teacherLeave) {
      const t = teacherMap.get(entry.teacherId);
      allConflicts.push(`Teacher ${t?.user.name || entry.teacherId} on leave: day ${entry.dayOfWeek}`);
    }
  }

  return {
    entries: allEntries,
    conflicts: allConflicts,
    message: allConflicts.length > 0
      ? `Generated ${allEntries.length} entries with ${allConflicts.length} conflicts`
      : `Successfully generated ${allEntries.length} conflict-free entries`,
  };
}
