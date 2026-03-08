import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

interface SubstituteSuggestion {
  entryId: string;
  substituteTeacherId: string;
  reason: string;
}

interface AffectedEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  batchId: string;
  subjectId: string;
  teacherId: string;
  classroomId: string;
  batch: { name: string; strength: number };
  subject: { name: string; code: string; id: string };
  classroom: { name: string };
  teacher: { user: { name: string } };
}

export async function findSubstitutesForLeave(leaveId: string) {
  const leave = await prisma.leave.findUnique({
    where: { id: leaveId },
    include: {
      teacher: {
        include: {
          user: { select: { name: true } },
          subjects: { include: { subject: true } },
        },
      },
    },
  });

  if (!leave) throw new Error("Leave not found");

  // Get affected days of week
  const affectedDays: number[] = [];
  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    const adjustedDay = day === 0 ? 6 : day - 1; // Convert to Mon=0
    if (adjustedDay < 7) affectedDays.push(adjustedDay);
  }

  const affectedEntries = await prisma.timetableEntry.findMany({
    where: {
      teacherId: leave.teacherId,
      dayOfWeek: { in: affectedDays },
      status: "SCHEDULED",
    },
    include: {
      batch: { select: { name: true, strength: true } },
      subject: { select: { name: true, code: true, id: true } },
      classroom: { select: { name: true } },
      teacher: { include: { user: { select: { name: true } } } },
    },
  });

  const availableTeachers = await prisma.teacher.findMany({
    where: { id: { not: leave.teacherId } },
    include: {
      user: { select: { name: true } },
      subjects: { include: { subject: true } },
      timetableEntries: {
        where: {
          dayOfWeek: { in: affectedDays },
          status: { in: ["SCHEDULED", "SUBSTITUTED"] },
        },
      },
      availability: {
        where: { dayOfWeek: { in: affectedDays } },
      },
    },
  });

  // Get AI suggestions
  const setting = await prisma.settings.findUnique({
    where: { key: "claude_api_key" },
  });

  let aiSuggestions: SubstituteSuggestion[] | null = null;

  if (setting && affectedEntries.length > 0) {
    try {
      aiSuggestions = await getAISuggestions(
        setting.value,
        leave.teacher.user.name,
        leave.startDate,
        leave.endDate,
        affectedEntries as AffectedEntry[],
        availableTeachers
      );
    } catch {
      // AI suggestions failed, continue without them
    }
  }

  return {
    leave,
    affectedEntries,
    availableTeachers: availableTeachers.map((t) => ({
      id: t.id,
      name: t.user.name,
      subjects: t.subjects.map((s) => s.subject.name),
      busySlots: t.timetableEntries.length,
    })),
    aiSuggestions,
  };
}

async function getAISuggestions(
  apiKey: string,
  teacherName: string,
  startDate: Date,
  endDate: Date,
  affectedEntries: AffectedEntry[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  availableTeachers: any[]
): Promise<SubstituteSuggestion[]> {
  const client = new Anthropic({ apiKey });

  const prompt = `A teacher named "${teacherName}" is on leave from ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}.

These classes need substitutes:
${affectedEntries.map((e) => `- Entry ${e.id}: ${e.subject.name} for ${e.batch.name} on day ${e.dayOfWeek} at ${e.startTime}-${e.endTime} in ${e.classroom.name}`).join("\n")}

Available teachers who could substitute:
${availableTeachers.map((t) => {
  const busySlots = t.timetableEntries.map((te: { dayOfWeek: number; startTime: string }) => `day${te.dayOfWeek}@${te.startTime}`).join(", ");
  return `- ${t.id} (${t.user.name}): teaches ${t.subjects.map((s: { subject: { name: string } }) => s.subject.name).join(", ")}, busy at: [${busySlots}]`;
}).join("\n")}

For each affected class, suggest the best substitute teacher. Prioritize:
1. Teacher must teach the same subject (CRITICAL - don't suggest if they can't teach it)
2. Teacher must NOT be busy at the same time slot (check their busy slots)
3. Teachers with lighter workload on that day

Return a JSON array: [{"entryId": "...", "substituteTeacherId": "...", "reason": "..."}]

Return ONLY the JSON array, nothing else.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON in AI response");
  return JSON.parse(jsonMatch[0]);
}

export async function assignSubstitute(
  entryId: string,
  substituteTeacherId: string,
  leaveId: string
) {
  // Validate entry exists and is SCHEDULED
  const entry = await prisma.timetableEntry.findUnique({
    where: { id: entryId },
    include: { subject: true, batch: true },
  });
  if (!entry) throw new Error("Timetable entry not found");
  if (entry.status !== "SCHEDULED") throw new Error("Entry is not in SCHEDULED status");

  // Check substitute teacher isn't double-booked at this time
  const conflict = await prisma.timetableEntry.findFirst({
    where: {
      OR: [
        { teacherId: substituteTeacherId },
        { substituteTeacherId: substituteTeacherId },
      ],
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      weekStart: entry.weekStart,
      status: { in: ["SCHEDULED", "SUBSTITUTED"] },
      id: { not: entryId },
    },
  });
  if (conflict) throw new Error("Substitute teacher is already booked at this time");

  // Check substitute teacher can teach this subject
  const canTeach = await prisma.teacherSubject.findFirst({
    where: {
      teacherId: substituteTeacherId,
      subjectId: entry.subjectId,
    },
  });
  if (!canTeach) throw new Error("Substitute teacher is not qualified for this subject");

  // Create SubstituteAssignment and update TimetableEntry in a transaction
  const result = await prisma.$transaction([
    prisma.substituteAssignment.create({
      data: {
        leaveId,
        originalEntryId: entryId,
        substituteTeacherId,
        status: "ACCEPTED",
      },
    }),
    prisma.timetableEntry.update({
      where: { id: entryId },
      data: {
        substituteTeacherId,
        status: "SUBSTITUTED",
      },
      include: {
        batch: { select: { name: true } },
        subject: { select: { name: true, code: true } },
        teacher: { include: { user: { select: { name: true } } } },
        substituteTeacher: { include: { user: { select: { name: true } } } },
        classroom: { select: { name: true } },
      },
    }),
  ]);

  return result[1]; // Return the updated entry
}

export async function cancelEntry(entryId: string) {
  const entry = await prisma.timetableEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Timetable entry not found");

  return prisma.timetableEntry.update({
    where: { id: entryId },
    data: { status: "CANCELLED" },
  });
}
