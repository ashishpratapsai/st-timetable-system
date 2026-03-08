import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/db";
import { BatchType } from "@prisma/client";
import { getSlotDurationHours } from "@/lib/utils";

// ─── Types ───

interface GeneratedEntry {
  batchId: string;
  subjectId: string;
  teacherId: string;
  classroomId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface AIPlanEntry {
  a: number; // assignment index
  d: number[]; // day numbers (0=Mon ... 5=Sat)
}

interface UnscheduledItem {
  teacherName: string;
  batchName: string;
  subjectName: string;
  day: number;
  reason: string;
}

interface ProcessedAssignment {
  index: number;
  teacherId: string;
  teacherName: string;
  batchId: string;
  batchName: string;
  batchType: string;
  centerId: string;
  centerName: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  slotsPerWeek: number;
  batchStrength: number;
  employmentType: string;
}

interface GenerationResult {
  entries: GeneratedEntry[];
  unscheduled: UnscheduledItem[];
  conflicts: string[]; // kept for backward compatibility
  message: string;
}

// ─── Constants ───

const SENIOR_BATCH_TYPES = new Set(["IIT_JEE", "JEE_MAINS", "NEET"]);
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── AI Provider ───

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

// ─── AI Calls (kept from original) ───

async function callClaude(prompt: string, apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
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
      maxOutputTokens: 8192,
    },
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ─── JSON Parsing ───

function parseJSON<T>(text: string): T[] {
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

// ─── Helpers ───

function isSeniorBatchType(batchType: string): boolean {
  return SENIOR_BATCH_TYPES.has(batchType);
}

function addToMap(map: Map<string, Set<string>>, key: string, value: string) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key)!.add(value);
}

// ─── Phase 1: Build Simplified AI Prompt ───

function buildDayPlanningPrompt(
  assignments: ProcessedAssignment[],
  availabilityMap: Record<string, Record<string, boolean>>,
  leaveDayMap: Record<string, number[]>,
  customPrompt: string,
): string {
  // For each teacher, figure out which days they are available
  const teacherDays: Record<string, Set<number>> = {};
  for (const a of assignments) {
    if (teacherDays[a.teacherId]) continue;
    const days = new Set<number>();
    for (let d = 0; d < 7; d++) {
      // Check if teacher is available on at least one slot this day
      const dayKey = `${d}`;
      const avail = availabilityMap[a.teacherId] || {};
      let hasSlot = false;
      for (const key of Object.keys(avail)) {
        if (key.startsWith(dayKey + "-") && avail[key]) {
          hasSlot = true;
          break;
        }
      }
      // Also check leave
      if (leaveDayMap[a.teacherId]?.includes(d)) continue;
      if (hasSlot) days.add(d);
    }
    teacherDays[a.teacherId] = days;
  }

  // Count available slots per teacher per day
  const teacherDaySlotCount: Record<string, Record<number, number>> = {};
  for (const a of assignments) {
    if (teacherDaySlotCount[a.teacherId]) continue;
    teacherDaySlotCount[a.teacherId] = {};
    const avail = availabilityMap[a.teacherId] || {};
    for (let d = 0; d < 7; d++) {
      if (leaveDayMap[a.teacherId]?.includes(d)) continue;
      let count = 0;
      for (const key of Object.keys(avail)) {
        if (key.startsWith(`${d}-`) && avail[key]) count++;
      }
      if (count > 0) teacherDaySlotCount[a.teacherId][d] = count;
    }
  }

  // Build human-readable assignment list with per-day slot counts
  const lines: string[] = [];
  for (const a of assignments) {
    const daySlots = teacherDaySlotCount[a.teacherId] || {};
    const availDaysStr = Object.entries(daySlots)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([d, count]) => `${DAY_NAMES[Number(d)]}(${count})`)
      .join(",");
    const typeTag = a.employmentType === "PART_TIME" ? " [Part-Time]" : "";
    lines.push(
      `${a.index}. ${a.teacherName}${typeTag} → ${a.batchName} → ${a.subjectName} (${a.slotsPerWeek} slots/wk, available: ${availDaysStr})`
    );
  }

  // Count total slots per teacher to help AI understand workload
  const teacherTotalSlots: Record<string, number> = {};
  const teacherNameMap: Record<string, string> = {};
  for (const a of assignments) {
    teacherTotalSlots[a.teacherId] = (teacherTotalSlots[a.teacherId] || 0) + a.slotsPerWeek;
    teacherNameMap[a.teacherId] = a.teacherName;
  }

  // Build teacher workload summary with capacity
  const workloadLines: string[] = [];
  for (const [tid, total] of Object.entries(teacherTotalSlots)) {
    const daySlots = teacherDaySlotCount[tid] || {};
    const totalCapacity = Object.values(daySlots).reduce((s, c) => s + c, 0);
    const capWarning = total > totalCapacity ? " ⚠️ NOT ENOUGH CAPACITY" : "";
    workloadLines.push(
      `  ${teacherNameMap[tid]}: ${total} total slots needed, ${totalCapacity} total capacity${capWarning}`
    );
  }

  return `You are a school timetable DAY PLANNER. Your ONLY job is to decide which DAYS each teaching assignment should happen.

ASSIGNMENTS (index. Teacher → Batch → Subject (slots needed, available days with slot count)):
${lines.join("\n")}

The number in parentheses after each day (e.g., Mon(3)) means the teacher has 3 available time slots on Monday.
If a teacher has 2 slots on a day, do NOT assign more than 2 slots of work to that day for that teacher.

TEACHER WORKLOAD SUMMARY:
${workloadLines.join("\n")}

DAYS: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
${customPrompt ? `\n=== ADMIN INSTRUCTIONS (YOU MUST STRICTLY FOLLOW THESE) ===\n${customPrompt}\n=== END ADMIN INSTRUCTIONS ===\n` : ""}
SCHEDULING MODEL:
- Classes are scheduled in CONSECUTIVE BLOCKS (2-3 slots back-to-back per day for each teacher-batch).
- So an assignment with 4 slots/wk might need only 2 days (2 consecutive slots each day).
- An assignment with 3 slots/wk could be 1 day with 3 consecutive slots, or 1 day with 2 + another with 1.
- FEWER UNIQUE DAYS is often better — group slots into blocks.
- The "d" array should list each day ONCE, even if multiple consecutive slots will be scheduled on that day.

CRITICAL RULES:
1. Return days for each assignment — the algorithm will figure out how many consecutive slots to book per day.
2. An assignment with N slots/wk needs FEWER days than N (because of consecutive blocks). Use ceil(slots / blockSize) days.
3. ONLY pick from the teacher's available days shown in parentheses. NEVER assign a day with 0 slots.
4. If a teacher has N available slots on a day, do NOT assign more than N slots of total work to that day.
5. Balance teacher workload across the week proportionally to each day's capacity.
6. A teacher may teach both junior and senior batches — avoid scheduling them at the same time.

Return ONLY a JSON array. No markdown code blocks. No explanation. No text before or after.
Each element: {"a": <assignment_index>, "d": [<day_numbers>]}
Example: [{"a":0,"d":[0,2]},{"a":1,"d":[1,3]}]`;
}

// ─── Phase 2: Deterministic Scheduler ───

function tryScheduleEntry(
  assignment: ProcessedAssignment,
  day: number,
  validSlots: { id: string; startTime: string; endTime: string; order: number }[],
  classrooms: { id: string; name: string; centerId: string; capacity: number }[],
  availabilityMap: Record<string, Record<string, boolean>>,
  leaveDayMap: Record<string, number[]>,
  classroomBlockSet: Set<string>,
  teacherBooked: Map<string, Set<string>>,
  classroomBooked: Map<string, Set<string>>,
  batchBooked: Map<string, Set<string>>,
): { entry: GeneratedEntry; reason: null } | { entry: null; reason: string } {
  // Teacher on leave this entire day — no point checking slots
  if (leaveDayMap[assignment.teacherId]?.includes(day)) {
    return { entry: null, reason: `Teacher on leave ${DAY_NAMES[day]}` };
  }

  let lastReason = "No valid time slot found";

  for (const slot of validSlots) {
    const timeKey = `${day}-${slot.startTime}`;

    // Check 1: Teacher not already booked at this time
    if (teacherBooked.get(assignment.teacherId)?.has(timeKey)) {
      lastReason = `Teacher already booked at ${DAY_NAMES[day]} ${slot.startTime}`;
      continue;
    }

    // Check 2: Teacher is available per availability grid
    const avail = availabilityMap[assignment.teacherId];
    if (avail && avail[timeKey] === false) {
      lastReason = `Teacher not available ${DAY_NAMES[day]} ${slot.startTime}`;
      continue;
    }

    // Check 3: Batch not already booked at this time
    if (batchBooked.get(assignment.batchId)?.has(timeKey)) {
      lastReason = `Batch already has class at ${DAY_NAMES[day]} ${slot.startTime}`;
      continue;
    }

    // Check 4: Find free classroom at correct center with enough capacity
    const centerClassrooms = classrooms
      .filter((c) => c.centerId === assignment.centerId && c.capacity >= assignment.batchStrength)
      .sort((a, b) => a.capacity - b.capacity); // prefer tightest fit

    let foundClassroom: typeof classrooms[0] | null = null;
    for (const room of centerClassrooms) {
      const roomKey = `${room.id}-${day}-${slot.startTime}`;
      if (classroomBooked.get(room.id)?.has(timeKey)) continue;
      if (classroomBlockSet.has(roomKey)) continue;
      foundClassroom = room;
      break;
    }

    if (!foundClassroom) {
      lastReason = `No classroom available at ${assignment.centerName} for ${DAY_NAMES[day]} ${slot.startTime}`;
      continue;
    }

    // ✅ All checks passed
    const entry: GeneratedEntry = {
      batchId: assignment.batchId,
      subjectId: assignment.subjectId,
      teacherId: assignment.teacherId,
      classroomId: foundClassroom.id,
      dayOfWeek: day,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };

    return { entry, reason: null };
  }

  return { entry: null, reason: lastReason };
}

function tryScheduleConsecutiveBlock(
  assignment: ProcessedAssignment,
  day: number,
  blockSize: number,
  validSlots: { id: string; startTime: string; endTime: string; order: number }[],
  classrooms: { id: string; name: string; centerId: string; capacity: number }[],
  availabilityMap: Record<string, Record<string, boolean>>,
  leaveDayMap: Record<string, number[]>,
  classroomBlockSet: Set<string>,
  teacherBooked: Map<string, Set<string>>,
  classroomBooked: Map<string, Set<string>>,
  batchBooked: Map<string, Set<string>>,
): { entries: GeneratedEntry[]; scheduled: number } {
  // Teacher on leave this day
  if (leaveDayMap[assignment.teacherId]?.includes(day)) {
    return { entries: [], scheduled: 0 };
  }

  // Try to find `blockSize` consecutive slots starting from each position
  for (let startIdx = 0; startIdx <= validSlots.length - blockSize; startIdx++) {
    const block = validSlots.slice(startIdx, startIdx + blockSize);

    // Check all slots in the block are consecutive (orders differ by 1)
    let isConsecutive = true;
    for (let i = 1; i < block.length; i++) {
      if (block[i].order !== block[i - 1].order + 1) {
        isConsecutive = false;
        break;
      }
    }
    if (!isConsecutive) continue;

    // Check all constraints for every slot in the block
    let allClear = true;
    let foundClassroom: typeof classrooms[0] | null = null;

    for (const slot of block) {
      const timeKey = `${day}-${slot.startTime}`;
      if (teacherBooked.get(assignment.teacherId)?.has(timeKey)) { allClear = false; break; }
      const avail = availabilityMap[assignment.teacherId];
      if (avail && avail[timeKey] === false) { allClear = false; break; }
      if (batchBooked.get(assignment.batchId)?.has(timeKey)) { allClear = false; break; }
    }
    if (!allClear) continue;

    // Find a classroom available for ALL slots in the block
    const centerClassrooms = classrooms
      .filter((c) => c.centerId === assignment.centerId && c.capacity >= assignment.batchStrength)
      .sort((a, b) => a.capacity - b.capacity);

    for (const room of centerClassrooms) {
      let roomFree = true;
      for (const slot of block) {
        const timeKey = `${day}-${slot.startTime}`;
        const roomKey = `${room.id}-${day}-${slot.startTime}`;
        if (classroomBooked.get(room.id)?.has(timeKey)) { roomFree = false; break; }
        if (classroomBlockSet.has(roomKey)) { roomFree = false; break; }
      }
      if (roomFree) { foundClassroom = room; break; }
    }
    if (!foundClassroom) continue;

    // All checks passed — book the entire block
    const blockEntries: GeneratedEntry[] = block.map((slot) => ({
      batchId: assignment.batchId,
      subjectId: assignment.subjectId,
      teacherId: assignment.teacherId,
      classroomId: foundClassroom!.id,
      dayOfWeek: day,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));

    return { entries: blockEntries, scheduled: blockSize };
  }

  return { entries: [], scheduled: 0 };
}

function scheduleFromAIPlan(
  aiPlan: AIPlanEntry[],
  assignments: ProcessedAssignment[],
  timeSlots: { id: string; startTime: string; endTime: string; order: number }[],
  classrooms: { id: string; name: string; centerId: string; capacity: number }[],
  availabilityMap: Record<string, Record<string, boolean>>,
  leaveDayMap: Record<string, number[]>,
  classroomBlockSet: Set<string>, // "classroomId-day-startTime"
  consecutiveSlotsPref: number, // 2 or 3 (from user preference), 0 = auto
  otherScopeEntries: { teacherId: string; classroomId: string; dayOfWeek: number; startTime: string }[] = [],
): { entries: GeneratedEntry[]; unscheduled: UnscheduledItem[] } {
  // Booking trackers — key format: "day-startTime"
  const teacherBooked = new Map<string, Set<string>>();
  const classroomBooked = new Map<string, Set<string>>();
  const batchBooked = new Map<string, Set<string>>();

  // Pre-populate booking maps with other-scope entries to avoid shared teacher/classroom conflicts
  for (const e of otherScopeEntries) {
    const timeKey = `${e.dayOfWeek}-${e.startTime}`;
    addToMap(teacherBooked, e.teacherId, timeKey);
    addToMap(classroomBooked, e.classroomId, timeKey);
  }

  // All slots available for all batch types (no morning/evening restriction)
  const allSlots = [...timeSlots].sort((a, b) => a.order - b.order);

  const entries: GeneratedEntry[] = [];
  const unscheduled: UnscheduledItem[] = [];

  // Build work items grouped by assignment: (assignment, days[])
  interface WorkGroup {
    assignment: ProcessedAssignment;
    days: number[];
  }
  const workGroups: WorkGroup[] = [];

  for (const plan of aiPlan) {
    const assignment = assignments.find((a) => a.index === plan.a);
    if (!assignment) continue;

    const days = [...new Set(plan.d)].filter((d) => d >= 0 && d <= 6);
    workGroups.push({ assignment, days });
  }

  // Sort by constraint tightness: most constrained first
  workGroups.sort((a, b) => {
    const aPart = a.assignment.employmentType === "PART_TIME" ? 0 : 1;
    const bPart = b.assignment.employmentType === "PART_TIME" ? 0 : 1;
    if (aPart !== bPart) return aPart - bPart;
    // Fewer slotsPerWeek first (more constrained)
    return a.assignment.slotsPerWeek - b.assignment.slotsPerWeek;
  });

  for (const { assignment, days } of workGroups) {
    const validSlots = allSlots;
    let remainingSlots = assignment.slotsPerWeek;

    // Determine block size for this assignment
    const maxBlockSize = consecutiveSlotsPref > 0 ? consecutiveSlotsPref : 2; // default to 2

    // Phase A: Try to schedule consecutive blocks on AI's preferred days
    for (const day of days) {
      if (remainingSlots <= 0) break;

      // Try the desired block size first, then smaller blocks, then single slots
      const blockSize = Math.min(maxBlockSize, remainingSlots);

      let scheduled = false;
      // Try block sizes from largest to smallest
      for (let trySize = blockSize; trySize >= 1; trySize--) {
        const result = tryScheduleConsecutiveBlock(
          assignment, day, trySize, validSlots, classrooms,
          availabilityMap, leaveDayMap, classroomBlockSet,
          teacherBooked, classroomBooked, batchBooked,
        );

        if (result.scheduled > 0) {
          for (const e of result.entries) {
            entries.push(e);
            addToMap(teacherBooked, assignment.teacherId, `${day}-${e.startTime}`);
            addToMap(classroomBooked, e.classroomId, `${day}-${e.startTime}`);
            addToMap(batchBooked, assignment.batchId, `${day}-${e.startTime}`);
          }
          remainingSlots -= result.scheduled;
          scheduled = true;
          break;
        }
      }

      if (!scheduled) {
        // Try single slot as last resort on this day
        const singleResult = tryScheduleEntry(
          assignment, day, validSlots, classrooms,
          availabilityMap, leaveDayMap, classroomBlockSet,
          teacherBooked, classroomBooked, batchBooked,
        );
        if (singleResult.entry) {
          entries.push(singleResult.entry);
          addToMap(teacherBooked, assignment.teacherId, `${day}-${singleResult.entry.startTime}`);
          addToMap(classroomBooked, singleResult.entry.classroomId, `${day}-${singleResult.entry.startTime}`);
          addToMap(batchBooked, assignment.batchId, `${day}-${singleResult.entry.startTime}`);
          remainingSlots -= 1;
        }
      }
    }

    // Phase B: Fallback — try all other days for remaining slots
    if (remainingSlots > 0) {
      const triedDays = new Set(days);
      const fallbackDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !triedDays.has(d));

      for (const altDay of fallbackDays) {
        if (remainingSlots <= 0) break;

        const blockSize = Math.min(maxBlockSize, remainingSlots);
        for (let trySize = blockSize; trySize >= 1; trySize--) {
          const result = tryScheduleConsecutiveBlock(
            assignment, altDay, trySize, validSlots, classrooms,
            availabilityMap, leaveDayMap, classroomBlockSet,
            teacherBooked, classroomBooked, batchBooked,
          );

          if (result.scheduled > 0) {
            for (const e of result.entries) {
              entries.push(e);
              addToMap(teacherBooked, assignment.teacherId, `${altDay}-${e.startTime}`);
              addToMap(classroomBooked, e.classroomId, `${altDay}-${e.startTime}`);
              addToMap(batchBooked, assignment.batchId, `${altDay}-${e.startTime}`);
            }
            remainingSlots -= result.scheduled;
            break;
          }
        }

        // Single slot fallback
        if (remainingSlots > 0) {
          const singleResult = tryScheduleEntry(
            assignment, altDay, validSlots, classrooms,
            availabilityMap, leaveDayMap, classroomBlockSet,
            teacherBooked, classroomBooked, batchBooked,
          );
          if (singleResult.entry) {
            entries.push(singleResult.entry);
            addToMap(teacherBooked, assignment.teacherId, `${altDay}-${singleResult.entry.startTime}`);
            addToMap(classroomBooked, singleResult.entry.classroomId, `${altDay}-${singleResult.entry.startTime}`);
            addToMap(batchBooked, assignment.batchId, `${altDay}-${singleResult.entry.startTime}`);
            remainingSlots -= 1;
          }
        }
      }
    }

    // Phase C: Report any remaining unscheduled slots
    for (let i = 0; i < remainingSlots; i++) {
      unscheduled.push({
        teacherName: assignment.teacherName,
        batchName: assignment.batchName,
        subjectName: assignment.subjectName,
        day: days[0] ?? 0,
        reason: `No available slot on any day — all slots full`,
      });
    }
  }

  return { entries, unscheduled };
}

function getValidSlotCount(
  item: { assignment: ProcessedAssignment; day: number },
  timeSlots: { order: number; startTime: string }[],
  availabilityMap: Record<string, Record<string, boolean>>,
  leaveDayMap: Record<string, number[]>,
  teacherBooked: Map<string, Set<string>>,
  batchBooked: Map<string, Set<string>>,
): number {
  const { assignment, day } = item;
  if (leaveDayMap[assignment.teacherId]?.includes(day)) return 0;

  const validSlots = timeSlots;

  let count = 0;
  for (const slot of validSlots) {
    const timeKey = `${day}-${slot.startTime}`;
    if (teacherBooked.get(assignment.teacherId)?.has(timeKey)) continue;
    if (batchBooked.get(assignment.batchId)?.has(timeKey)) continue;
    const avail = availabilityMap[assignment.teacherId];
    if (avail && avail[timeKey] === false) continue;
    count++;
  }
  return count;
}

// ─── Deterministic Fallback Plan ───

function buildDeterministicPlan(
  assignments: ProcessedAssignment[],
  availabilityMap: Record<string, Record<string, boolean>>,
  leaveDayMap: Record<string, number[]>,
): AIPlanEntry[] {
  const plan: AIPlanEntry[] = [];

  // Track how many slots assigned per teacher per day for load balancing
  const teacherDayLoad: Record<string, Record<number, number>> = {};

  for (const a of assignments) {
    // Find available days for this teacher
    const availDays: { day: number; capacity: number }[] = [];
    const avail = availabilityMap[a.teacherId] || {};
    for (let d = 0; d < 7; d++) {
      if (leaveDayMap[a.teacherId]?.includes(d)) continue;
      let count = 0;
      for (const key of Object.keys(avail)) {
        if (key.startsWith(`${d}-`) && avail[key]) count++;
      }
      // If no availability records, assume available (count all 7 potential slots)
      if (Object.keys(avail).length === 0) count = 7;
      if (count > 0) availDays.push({ day: d, capacity: count });
    }

    if (availDays.length === 0) continue;

    // Sort by current load (ascending) to balance across days
    availDays.sort((a, b) => {
      const loadA = teacherDayLoad[a.day]?.[a.day] || 0;
      const loadB = teacherDayLoad[b.day]?.[b.day] || 0;
      return loadA - loadB;
    });

    // Pick enough days for this assignment (consecutive blocks = fewer days needed)
    const blockSize = 2; // default consecutive block size
    const daysNeeded = Math.ceil(a.slotsPerWeek / blockSize);
    const selectedDays = availDays.slice(0, Math.min(daysNeeded, availDays.length)).map((d) => d.day);

    plan.push({ a: a.index, d: selectedDays });

    // Update load tracking
    if (!teacherDayLoad[a.teacherId]) teacherDayLoad[a.teacherId] = {};
    for (const d of selectedDays) {
      teacherDayLoad[a.teacherId][d] = (teacherDayLoad[a.teacherId][d] || 0) + blockSize;
    }
  }

  return plan;
}

// ─── Pre-Generation Validation ───

export interface ValidationIssue {
  id: string;
  type: "error" | "warning" | "info";
  category: "availability" | "capacity" | "conflict" | "preference";
  message: string;
  teacherName?: string;
  suggestion?: string;
}

export async function validateBeforeGeneration(
  centerId: string | null,
  weekStart: Date,
  scope: "senior" | "junior" | "all" = "all",
  customPrompt: string = "",
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const [teachers, batches, timeSlots, teachingAssignments, approvedLeaves] = await Promise.all([
    prisma.teacher.findMany({
      include: { user: { select: { name: true } }, availability: true },
    }),
    prisma.batch.findMany({
      where: {
        status: "ACTIVE",
        ...(centerId ? { centerId } : {}),
        ...(scope === "senior"
          ? { batchType: { in: [BatchType.IIT_JEE, BatchType.JEE_MAINS, BatchType.NEET] } }
          : scope === "junior"
            ? { batchType: { notIn: [BatchType.IIT_JEE, BatchType.JEE_MAINS, BatchType.NEET] } }
            : {}),
      },
    }),
    prisma.timeSlot.findMany({
      where: scope !== "all" ? { OR: [{ scope }, { scope: "all" }] } : {},
    }),
    prisma.teachingAssignment.findMany({
      where: { startDate: { lte: weekStart }, endDate: { gte: weekStart } },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        batch: { include: { center: { select: { name: true } } } },
        subject: true,
      },
    }),
    prisma.leave.findMany({
      where: { status: "APPROVED", startDate: { lte: weekEnd }, endDate: { gte: weekStart } },
      include: { teacher: { include: { user: { select: { name: true } } } } },
    }),
  ]);

  const batchIds = new Set(batches.map((b) => b.id));
  const relevantAssignments = teachingAssignments.filter((a) => batchIds.has(a.batchId));

  // Build availability map
  const availabilityMap: Record<string, Record<string, boolean>> = {};
  for (const t of teachers) {
    availabilityMap[t.id] = {};
    for (const a of t.availability) {
      availabilityMap[t.id][`${a.dayOfWeek}-${a.startTime}`] = a.isAvailable;
    }
  }

  // Build leave day map
  const leaveDayMap: Record<string, number[]> = {};
  for (const l of approvedLeaves) {
    if (!leaveDayMap[l.teacherId]) leaveDayMap[l.teacherId] = [];
    const start = new Date(l.startDate);
    const end = new Date(l.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const adjustedDay = day === 0 ? 6 : day - 1;
      if (adjustedDay < 7) leaveDayMap[l.teacherId].push(adjustedDay);
    }
  }

  // Per-teacher: count total needed vs total capacity
  const teacherSlots: Record<string, { name: string; totalNeeded: number }> = {};
  const avgSlotHours = timeSlots.length > 0
    ? timeSlots.reduce((sum, s) => sum + getSlotDurationHours(s.startTime, s.endTime), 0) / timeSlots.length
    : 1.5;

  for (const a of relevantAssignments) {
    const totalWeeks = Math.max(1, Math.ceil((new Date(a.endDate).getTime() - new Date(a.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)));
    const hoursPerWeek = (a.totalHours - a.completedHours) / totalWeeks;
    const slotsPerWeek = Math.max(1, Math.ceil(hoursPerWeek / avgSlotHours));

    if (!teacherSlots[a.teacherId]) {
      teacherSlots[a.teacherId] = { name: a.teacher.user.name, totalNeeded: 0 };
    }
    teacherSlots[a.teacherId].totalNeeded += slotsPerWeek;
  }

  for (const [teacherId, info] of Object.entries(teacherSlots)) {
    const avail = availabilityMap[teacherId] || {};
    let totalCapacity = 0;

    for (let d = 0; d < 7; d++) {
      if (leaveDayMap[teacherId]?.includes(d)) continue;
      for (const key of Object.keys(avail)) {
        if (key.startsWith(`${d}-`) && avail[key]) totalCapacity++;
      }
    }

    // If no availability records at all, assume full capacity
    if (Object.keys(avail).length === 0) {
      totalCapacity = 7 * timeSlots.length;
    }

    if (info.totalNeeded > totalCapacity) {
      issues.push({
        id: `capacity-${teacherId}`,
        type: "error",
        category: "capacity",
        message: `${info.name} needs ${info.totalNeeded} slots/week but only has ${totalCapacity} available slots.`,
        teacherName: info.name,
        suggestion: `Increase ${info.name}'s availability or reduce their teaching load.`,
      });
    } else if (info.totalNeeded > totalCapacity * 0.8) {
      issues.push({
        id: `load-${teacherId}`,
        type: "warning",
        category: "capacity",
        message: `${info.name} is at ${Math.round((info.totalNeeded / totalCapacity) * 100)}% capacity (${info.totalNeeded}/${totalCapacity} slots).`,
        teacherName: info.name,
      });
    }
  }

  // Check teachers on leave this week
  for (const l of approvedLeaves) {
    const leaveDays = (leaveDayMap[l.teacherId] || []).map((d) => DAY_NAMES[d]).join(", ");
    issues.push({
      id: `leave-${l.id}`,
      type: "warning",
      category: "availability",
      message: `${l.teacher.user.name} is on leave: ${leaveDays}. Classes on those days will be skipped.`,
      teacherName: l.teacher.user.name,
    });
  }

  // Check custom prompt contradictions
  const lowerPrompt = customPrompt.toLowerCase();
  if (lowerPrompt.includes("saturday off") || lowerPrompt.includes("do not schedule any classes on saturday")) {
    // Check if any teacher ONLY has Saturday availability
    for (const [teacherId, info] of Object.entries(teacherSlots)) {
      const avail = availabilityMap[teacherId] || {};
      let nonSatSlots = 0;
      for (const key of Object.keys(avail)) {
        if (!key.startsWith("5-") && avail[key]) nonSatSlots++;
      }
      if (nonSatSlots === 0 && Object.keys(avail).length > 0) {
        issues.push({
          id: `sat-conflict-${teacherId}`,
          type: "error",
          category: "preference",
          message: `"Saturday off" requested but ${info.name} is ONLY available on Saturday.`,
          teacherName: info.name,
          suggestion: `Either allow Saturday classes or update ${info.name}'s availability to include other days.`,
        });
      }
    }
  }

  // Summary info
  const totalSlots = Object.values(teacherSlots).reduce((s, i) => s + i.totalNeeded, 0);
  issues.push({
    id: "summary",
    type: "info",
    category: "capacity",
    message: `${relevantAssignments.length} assignments, ${totalSlots} total slots needed, ${teachers.length} teachers.`,
  });

  return issues;
}

// ─── Main Generation Function ───

export async function generateTimetable(
  centerId: string | null,
  weekStart: Date,
  scope: "senior" | "junior" | "all" = "all"
): Promise<GenerationResult> {
  const { provider, apiKey } = await getAIProvider();

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // Fetch all data (same Prisma queries as before)
  const [teachers, batches, classrooms, timeSlots, teachingAssignments, classroomBlocks, approvedLeaves] =
    await Promise.all([
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
          ...(scope === "senior"
            ? { batchType: { in: [BatchType.IIT_JEE, BatchType.JEE_MAINS, BatchType.NEET] } }
            : scope === "junior"
              ? { batchType: { notIn: [BatchType.IIT_JEE, BatchType.JEE_MAINS, BatchType.NEET] } }
              : {}),
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
      prisma.timeSlot.findMany({
        where: scope !== "all" ? { OR: [{ scope }, { scope: "all" }] } : {},
        orderBy: { order: "asc" },
      }),
      prisma.teachingAssignment.findMany({
        where: {
          startDate: { lte: weekStart },
          endDate: { gte: weekStart },
        },
        include: {
          teacher: { include: { user: { select: { name: true } } } },
          batch: { include: { center: { select: { id: true, name: true } } } },
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

  // Filter assignments to only include batches we're generating for
  const batchIds = new Set(batches.map((b) => b.id));
  const relevantAssignments = teachingAssignments.filter((a) => batchIds.has(a.batchId));

  if (relevantAssignments.length === 0) {
    const scopeLabel = scope === "senior" ? "senior (11th-12th)" : scope === "junior" ? "junior (8th-10th)" : "";
    return {
      entries: [],
      unscheduled: [],
      conflicts: [],
      message: `No teaching assignments found for the selected center and week${scopeLabel ? ` (${scopeLabel} scope)` : ""}.`,
    };
  }

  // Build availability map: teacherId -> { "day-startTime": boolean }
  const availabilityMap: Record<string, Record<string, boolean>> = {};
  for (const t of teachers) {
    availabilityMap[t.id] = {};
    for (const a of t.availability) {
      availabilityMap[t.id][`${a.dayOfWeek}-${a.startTime}`] = a.isAvailable;
    }
  }

  // Build leave day map: teacherId -> [dayOfWeek numbers]
  const leaveDayMap: Record<string, number[]> = {};
  for (const l of approvedLeaves) {
    if (!leaveDayMap[l.teacherId]) leaveDayMap[l.teacherId] = [];
    const start = new Date(l.startDate);
    const end = new Date(l.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const adjustedDay = day === 0 ? 6 : day - 1; // Convert Sun=0..Sat=6 to Mon=0..Sun=6
      if (adjustedDay < 7) leaveDayMap[l.teacherId].push(adjustedDay);
    }
  }

  // Build classroom block set: "classroomId-day-startTime"
  const classroomBlockSet = new Set<string>();
  for (const b of classroomBlocks) {
    const blockDate = new Date(b.date);
    const day = blockDate.getDay();
    const adjustedDay = day === 0 ? 6 : day - 1;
    classroomBlockSet.add(`${b.classroomId}-${adjustedDay}-${b.startTime}`);
  }

  // Process assignments into indexed list with human-readable names
  const processedAssignments: ProcessedAssignment[] = relevantAssignments.map((a, i) => {
    const startDate = new Date(a.startDate);
    const endDate = new Date(a.endDate);
    const totalWeeks = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    const remainingHours = a.totalHours - a.completedHours;
    const hoursPerWeek = remainingHours / totalWeeks;
    const avgSlotHours = timeSlots.length > 0
      ? timeSlots.reduce((sum, s) => sum + getSlotDurationHours(s.startTime, s.endTime), 0) / timeSlots.length
      : 1.5;
    const slotsPerWeek = Math.max(1, Math.ceil(hoursPerWeek / avgSlotHours));

    const teacher = teachers.find((t) => t.id === a.teacherId);

    return {
      index: i,
      teacherId: a.teacherId,
      teacherName: a.teacher.user.name,
      batchId: a.batchId,
      batchName: a.batch.name,
      batchType: a.batch.batchType,
      centerId: a.batch.centerId,
      centerName: a.batch.center.name,
      subjectId: a.subjectId,
      subjectName: a.subject.name,
      subjectCode: a.subject.code,
      slotsPerWeek,
      batchStrength: batches.find((b) => b.id === a.batchId)?.strength || 30,
      employmentType: teacher?.employmentType || "FULL_TIME",
    };
  });

  // Fetch custom prompt and consecutive slots preference
  const [customPromptSetting, consecutiveSlotsSetting] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "ai_custom_prompt" } }),
    prisma.settings.findUnique({ where: { key: "consecutive_slots" } }),
  ]);
  const customPrompt = customPromptSetting?.value || "";
  const consecutiveSlotsValue = consecutiveSlotsSetting?.value || "2";
  const consecutiveSlotsPref = consecutiveSlotsValue === "custom" ? 0 : parseInt(consecutiveSlotsValue) || 2;

  // ─── Phase 1: AI Day Planning ───
  console.log(`[Timetable] Phase 1: AI day planning for ${processedAssignments.length} assignments (scope: ${scope})`);

  const prompt = buildDayPlanningPrompt(processedAssignments, availabilityMap, leaveDayMap, customPrompt);

  // Retry AI call up to 3 times with backoff
  let aiPlan: AIPlanEntry[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const responseText = provider === "gemini"
        ? await callGemini(prompt, apiKey)
        : await callClaude(prompt, apiKey);

      aiPlan = parseJSON<AIPlanEntry>(responseText);
      aiPlan = aiPlan.filter(
        (p) => typeof p.a === "number" && Array.isArray(p.d) && p.d.every((d) => typeof d === "number")
      );

      if (aiPlan.length > 0) {
        console.log(`[Timetable] AI attempt ${attempt}/3 succeeded: ${aiPlan.length} day plans`);
        break;
      }
      console.warn(`[Timetable] AI attempt ${attempt}/3 returned empty plan`);
    } catch (err) {
      console.warn(`[Timetable] AI attempt ${attempt}/3 failed:`, err);
    }
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  // Deterministic fallback if AI failed completely
  if (aiPlan.length === 0) {
    console.log(`[Timetable] Using deterministic fallback plan`);
    aiPlan = buildDeterministicPlan(processedAssignments, availabilityMap, leaveDayMap);
  }

  // Enforce questionnaire rules deterministically (override AI if needed)
  const lowerPrompt = customPrompt.toLowerCase();
  if (lowerPrompt.includes("do not schedule any classes on saturday") || lowerPrompt.includes("saturday off")) {
    aiPlan = aiPlan.map((p) => ({ ...p, d: p.d.filter((d) => d !== 5) }));
  }
  if (lowerPrompt.includes("do not schedule any classes on sunday") || lowerPrompt.includes("sunday off")) {
    aiPlan = aiPlan.map((p) => ({ ...p, d: p.d.filter((d) => d !== 6) }));
  }
  if (lowerPrompt.includes("saturday light") || lowerPrompt.includes("keep saturday light")) {
    // Cap Saturday assignments — remove day 5 if teacher already has many other days
    aiPlan = aiPlan.map((p) => {
      if (p.d.includes(5) && p.d.length > 2) {
        return { ...p, d: p.d.filter((d) => d !== 5) };
      }
      return p;
    });
  }

  // Handle missing assignments — if AI didn't plan some, add fallback days
  const plannedIndices = new Set(aiPlan.map((p) => p.a));
  for (const assignment of processedAssignments) {
    if (!plannedIndices.has(assignment.index)) {
      // Fallback: spread across available days
      const availDays: number[] = [];
      for (let d = 0; d < 7; d++) {
        if (leaveDayMap[assignment.teacherId]?.includes(d)) continue;
        const avail = availabilityMap[assignment.teacherId] || {};
        for (const key of Object.keys(avail)) {
          if (key.startsWith(`${d}-`) && avail[key]) {
            availDays.push(d);
            break;
          }
        }
      }
      // Pick first N days
      const days = availDays.slice(0, assignment.slotsPerWeek);
      if (days.length > 0) {
        aiPlan.push({ a: assignment.index, d: days });
      }
    }
  }

  // ─── Phase 2: Deterministic Scheduling ───
  console.log(`[Timetable] Phase 2: Deterministic slot/room assignment (scope: ${scope})`);

  const slotData = timeSlots.map((s) => ({
    id: s.id,
    startTime: s.startTime,
    endTime: s.endTime,
    order: s.order,
  }));

  const classroomData = classrooms.map((c) => ({
    id: c.id,
    name: c.name,
    centerId: c.centerId,
    capacity: c.capacity,
  }));

  // Fetch existing entries from the OTHER scope to avoid shared teacher/classroom conflicts
  let otherScopeEntries: { teacherId: string; classroomId: string; dayOfWeek: number; startTime: string }[] = [];
  if (scope !== "all") {
    const SENIOR_TYPES: BatchType[] = [BatchType.IIT_JEE, BatchType.JEE_MAINS, BatchType.NEET];
    otherScopeEntries = await prisma.timetableEntry.findMany({
      where: {
        weekStart,
        batch: {
          batchType: scope === "senior"
            ? { notIn: SENIOR_TYPES }
            : { in: SENIOR_TYPES },
        },
      },
      select: { teacherId: true, classroomId: true, dayOfWeek: true, startTime: true },
    });
    console.log(`[Timetable] Found ${otherScopeEntries.length} entries from other scope to protect`);
  }

  const { entries, unscheduled } = scheduleFromAIPlan(
    aiPlan,
    processedAssignments,
    slotData,
    classroomData,
    availabilityMap,
    leaveDayMap,
    classroomBlockSet,
    consecutiveSlotsPref,
    otherScopeEntries,
  );

  // ─── Phase 3: Report results ───
  const totalNeeded = processedAssignments.reduce((sum, a) => sum + a.slotsPerWeek, 0);
  const scheduled = entries.length;

  const scopeTag = scope === "senior" ? " (Senior)" : scope === "junior" ? " (Junior)" : "";
  let message: string;
  if (unscheduled.length === 0) {
    message = `✅ Successfully scheduled all ${scheduled}${scopeTag} entries with zero conflicts.`;
  } else {
    message = `Scheduled ${scheduled}/${totalNeeded}${scopeTag} entries. ${unscheduled.length} could not be scheduled.`;
  }

  console.log(`[Timetable] Result: ${scheduled} scheduled, ${unscheduled.length} unscheduled`);

  return {
    entries,
    unscheduled,
    conflicts: [], // always empty — algorithm guarantees no conflicts
    message,
  };
}
