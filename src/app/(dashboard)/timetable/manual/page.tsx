"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/header";
import { DAYS_OF_WEEK } from "@/lib/utils";
import { format, startOfWeek, addDays } from "date-fns";

// ─── Types ───
interface Teacher {
  id: string;
  user: { name: string };
  employmentType: string;
  subjects: { subject: { id: string; name: string; code: string } }[];
}
interface Batch {
  id: string;
  name: string;
  centerId: string;
  strength: number;
  batchType: string;
  center: { name: string };
}
interface Classroom {
  id: string;
  name: string;
  centerId: string;
  capacity: number;
  center: { name: string };
}
interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
  order: number;
  scope: string;
}
interface Center {
  id: string;
  name: string;
}
interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  status: string;
  batchId: string;
  subjectId: string;
  teacherId: string;
  classroomId: string;
  batch: { id: string; name: string; batchType: string };
  subject: { id: string; name: string; code: string };
  teacher: { id: string; user: { name: string } };
  substituteTeacher: { id: string; user: { name: string } } | null;
  classroom: { id: string; name: string; center: { name: string } };
}
interface TeachingAssignment {
  id: string;
  teacherId: string;
  batchId: string;
  subjectId: string;
  totalHours: number;
  completedHours: number;
  hoursPerWeek: number;
  slotsPerWeek: number;
  teacher: { id: string; user: { name: string } };
  batch: { id: string; name: string; batchType: string; center: { name: string } };
  subject: { id: string; name: string; code: string };
}

interface DragData {
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectCode: string;
  batchId: string;
  batchName: string;
}

type Scope = "senior" | "junior" | "all";
const SENIOR_BATCH_TYPES = ["IIT_JEE", "JEE_MAINS", "NEET"];

interface AvailabilityRecord {
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  isAvailable: boolean;
}

const SUBJECT_COLORS: Record<string, string> = {
  PHY: "bg-blue-50 text-blue-800 border-blue-300",
  CHE: "bg-emerald-50 text-emerald-700 border-emerald-300",
  MAT: "bg-violet-50 text-violet-700 border-violet-300",
  BIO: "bg-amber-50 text-amber-700 border-amber-300",
  ENG: "bg-pink-100 text-pink-800 border-pink-300",
};

export default function ManualTimetablePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  });
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedScope, setSelectedScope] = useState<Scope>("all");
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, Record<string, boolean>>>({});
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);

  const dragDataRef = useRef<DragData | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ weekStart: selectedWeek });
    if (selectedCenter) params.set("centerId", selectedCenter);

    const [e, t, b, c, s, cn, a, avail] = await Promise.all([
      fetch(`/api/timetable/entries?${params}`).then((r) => r.json()),
      fetch("/api/teachers").then((r) => r.json()),
      fetch("/api/batches").then((r) => r.json()),
      fetch("/api/classrooms").then((r) => r.json()),
      fetch("/api/time-slots").then((r) => r.json()),
      fetch("/api/centers").then((r) => r.json()),
      fetch("/api/teaching-assignments").then((r) => r.json()),
      fetch("/api/availability").then((r) => r.json()),
    ]);
    setEntries(Array.isArray(e) ? e : []);
    setTeachers(t);
    setBatches(b.filter((batch: Batch) => batch.centerId));
    setClassrooms(c);
    setTimeSlots(s);
    setCenters(cn);
    setAssignments(a);

    // Build availability map: teacherId → { "dayOfWeek-startTime" → boolean }
    const aMap: Record<string, Record<string, boolean>> = {};
    if (Array.isArray(avail)) {
      for (const rec of avail as AvailabilityRecord[]) {
        if (!aMap[rec.teacherId]) aMap[rec.teacherId] = {};
        aMap[rec.teacherId][`${rec.dayOfWeek}-${rec.startTime}`] = rec.isAvailable;
      }
    }
    setAvailabilityMap(aMap);
    setLoading(false);
  }, [selectedWeek, selectedCenter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Computed data ───
  const filteredBatches = batches.filter((b) => {
    if (selectedCenter && b.centerId !== selectedCenter) return false;
    if (selectedScope === "senior") return SENIOR_BATCH_TYPES.includes(b.batchType);
    if (selectedScope === "junior") return !SENIOR_BATCH_TYPES.includes(b.batchType);
    return true;
  });
  const filteredSlots = timeSlots.filter((s) =>
    selectedScope === "all" || s.scope === "all" || s.scope === selectedScope
  );
  const currentBatch = filteredBatches.find((b) => b.id === selectedBatch) || filteredBatches[0];
  const batchId = currentBatch?.id || "";

  // Get assignments for this batch
  const batchAssignments = assignments.filter((a) => a.batchId === batchId);

  // Count scheduled slots per assignment
  function getScheduledSlots(teacherId: string, subjectId: string, forBatchId: string) {
    return entries.filter(
      (e) => e.teacherId === teacherId && e.subjectId === subjectId && e.batchId === forBatchId && e.status !== "CANCELLED"
    ).length;
  }

  // Check if teacher is busy at a given time
  function isTeacherBusy(teacherId: string, day: number, startTime: string) {
    return entries.some(
      (e) => e.teacherId === teacherId && e.dayOfWeek === day && e.startTime === startTime && e.status !== "CANCELLED"
    );
  }

  // Check if batch already has a class at that time
  function isBatchBusy(forBatchId: string, day: number, startTime: string) {
    return entries.some(
      (e) => e.batchId === forBatchId && e.dayOfWeek === day && e.startTime === startTime && e.status !== "CANCELLED"
    );
  }

  // Check if teacher is unavailable at a given time (from availability grid)
  function isTeacherUnavailable(teacherId: string, day: number, startTime: string): boolean {
    const teacherAvail = availabilityMap[teacherId];
    if (!teacherAvail) return false; // No records = available everywhere
    return teacherAvail[`${day}-${startTime}`] === false;
  }

  // Find available classroom for batch
  function findAvailableClassroom(forBatchId: string, day: number, startTime: string): Classroom | null {
    const batch = batches.find((b) => b.id === forBatchId);
    if (!batch) return null;
    const centerRooms = classrooms.filter((c) => c.centerId === batch.centerId && c.capacity >= batch.strength);
    for (const room of centerRooms) {
      const booked = entries.some(
        (e) => e.classroomId === room.id && e.dayOfWeek === day && e.startTime === startTime && e.status !== "CANCELLED"
      );
      if (!booked) return room;
    }
    return null;
  }

  // ─── Drag and Drop ───
  function handleDragStart(data: DragData) {
    dragDataRef.current = data;
    setActiveDragData(data);
  }

  function handleDragEnd() {
    setActiveDragData(null);
    setDragOverCell(null);
  }

  function handleDragOver(e: React.DragEvent, cellKey: string) {
    e.preventDefault();
    setDragOverCell(cellKey);
  }

  function handleDragLeave() {
    setDragOverCell(null);
  }

  async function handleDrop(e: React.DragEvent, day: number, slot: TimeSlot) {
    e.preventDefault();
    setDragOverCell(null);
    setActiveDragData(null);
    const data = dragDataRef.current;
    if (!data) return;

    setError(null);

    // Validate
    if (isTeacherBusy(data.teacherId, day, slot.startTime)) {
      setError(`${data.teacherName} is already teaching at ${DAYS_OF_WEEK[day]} ${slot.startTime}`);
      return;
    }
    if (isTeacherUnavailable(data.teacherId, day, slot.startTime)) {
      setError(`${data.teacherName} is not available on ${DAYS_OF_WEEK[day]} at ${slot.startTime}`);
      return;
    }
    if (isBatchBusy(data.batchId, day, slot.startTime)) {
      setError(`${data.batchName} already has a class at ${DAYS_OF_WEEK[day]} ${slot.startTime}`);
      return;
    }

    const room = findAvailableClassroom(data.batchId, day, slot.startTime);
    if (!room) {
      setError(`No available classroom for ${data.batchName} at ${DAYS_OF_WEEK[day]} ${slot.startTime}`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/timetable/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: data.batchId,
          subjectId: data.subjectId,
          teacherId: data.teacherId,
          classroomId: room.id,
          dayOfWeek: day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          weekStart: selectedWeek,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to add entry");
      } else {
        const newEntry = await res.json();
        setEntries((prev) => [...prev, newEntry]);
      }
    } catch {
      setError("Failed to save entry");
    }
    setSaving(false);
  }

  async function handleDeleteEntry(entryId: string) {
    const res = await fetch(`/api/timetable/entries/${entryId}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, status: "CANCELLED" } : e));
    }
  }

  // ─── Rendering helpers ───
  function getEntriesForCell(day: number, startTime: string) {
    return entries.filter(
      (e) => e.batchId === batchId && e.dayOfWeek === day && e.startTime === startTime && e.status !== "CANCELLED"
    );
  }

  function getCellKey(day: number, startTime: string) {
    return `${day}-${startTime}`;
  }

  function getWeekDates() {
    const start = new Date(selectedWeek);
    return DAYS_OF_WEEK.slice(0, 7).map((day, i) => ({
      day,
      date: format(addDays(start, i), "MMM d"),
    }));
  }

  const weekDates = getWeekDates();

  // Teacher stats for sidebar
  function getTeacherWeeklyLoad(teacherId: string) {
    return entries.filter((e) => e.teacherId === teacherId && e.status !== "CANCELLED").length;
  }

  if (loading) {
    return (
      <div>
        <Header title="Manual Timetable Editor" />
        <div className="p-3 sm:p-4 md:p-6">
          <div className="py-12 space-y-4">
            <div className="h-10 skeleton w-full max-w-2xl mx-auto" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-75" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-50" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Manual Timetable Editor" />
      <div className="p-3 sm:p-4 md:p-6 animate-fadeIn">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Manual Timetable Editor</h1>
            <p className="text-[11px] sm:text-xs text-slate-500">Drag assignments from the sidebar and drop them into time slots</p>
          </div>
          <a href="/timetable" className="text-sm text-blue-600 hover:underline whitespace-nowrap">
            &larr; Back to Timetable View
          </a>
        </div>

        {/* Scope Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
          {(["all", "senior", "junior"] as Scope[]).map((scope) => (
            <button
              key={scope}
              onClick={() => { setSelectedScope(scope); setSelectedBatch(""); }}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                selectedScope === scope
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {scope === "all" ? "All Batches" : scope === "senior" ? "Senior (11th/12th)" : "Junior (8th-10th)"}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:flex sm:gap-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Week</label>
            <input type="date" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Center</label>
            <select value={selectedCenter} onChange={(e) => { setSelectedCenter(e.target.value); setSelectedBatch(""); }}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200">
              <option value="">All Centers</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Batch</label>
            <select value={selectedBatch || batchId} onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200">
              {filteredBatches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.center.name})</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <span className="text-xs text-slate-400">
              {entries.filter((e) => e.batchId === batchId && e.status !== "CANCELLED").length} slots filled for this batch
            </span>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-rose-50 border border-red-200 text-rose-700 text-sm px-4 py-2 rounded-lg mb-4 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4">&times;</button>
          </div>
        )}

        {saving && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2 rounded-lg mb-4">
            Saving...
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4">
          {/* ─── Main Grid ─── */}
          <div className="flex-1 -mx-3 sm:mx-0 overflow-auto">
            <div className="bg-white sm:rounded-2xl border border-slate-200/70 shadow-md overflow-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50/80 w-24">
                      Time
                    </th>
                    {weekDates.map(({ day, date }, i) => (
                      <th key={i} className="text-center px-1 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px]">
                        <div>{day}</div>
                        <div className="text-[10px] text-slate-400">{date}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSlots.map((slot) => (
                    <tr key={slot.id} className="border-b border-slate-100">
                      <td className="px-3 py-1 text-[11px] font-medium text-slate-500 sticky left-0 bg-white whitespace-nowrap">
                        {slot.startTime}-{slot.endTime}
                      </td>
                      {weekDates.map((_, dayIndex) => {
                        const cellKey = getCellKey(dayIndex, slot.startTime);
                        const cellEntries = getEntriesForCell(dayIndex, slot.startTime);
                        const isDragOver = dragOverCell === cellKey;
                        const batchBusy = isBatchBusy(batchId, dayIndex, slot.startTime);
                        const teacherBusy = activeDragData ? isTeacherBusy(activeDragData.teacherId, dayIndex, slot.startTime) : false;
                        const teacherNotAvailable = activeDragData ? isTeacherUnavailable(activeDragData.teacherId, dayIndex, slot.startTime) : false;

                        // Determine drag-over state for visual feedback
                        let dragBgClass = "";
                        if (isDragOver) {
                          if (teacherNotAvailable) dragBgClass = "bg-rose-50";
                          else if (teacherBusy) dragBgClass = "bg-amber-50";
                          else if (batchBusy) dragBgClass = "bg-rose-50";
                          else dragBgClass = "bg-blue-50";
                        }

                        return (
                          <td
                            key={dayIndex}
                            className={`px-1 py-1 min-h-[60px] transition-colors ${dragBgClass}`}
                            onDragOver={(e) => handleDragOver(e, cellKey)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, dayIndex, slot)}
                          >
                            {cellEntries.map((entry) => {
                              const colorClass = SUBJECT_COLORS[entry.subject.code] || "bg-slate-100 text-slate-800 border-slate-200";
                              return (
                                <div key={entry.id} className={`${colorClass} border rounded-lg p-1.5 text-[11px] mb-1 relative group`}>
                                  <div className="font-semibold">{entry.subject.code}</div>
                                  <div className="text-[10px] opacity-70">{entry.teacher.user.name}</div>
                                  <div className="text-[10px] opacity-50">{entry.classroom.name}</div>
                                  <button
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-600"
                                    title="Remove"
                                  >
                                    &times;
                                  </button>
                                </div>
                              );
                            })}
                            {cellEntries.length === 0 && isDragOver && (
                              <div className={`border-2 border-dashed rounded-lg p-2 text-[10px] text-center ${
                                teacherNotAvailable ? "border-red-300 text-red-500" :
                                teacherBusy ? "border-amber-300 text-amber-600" :
                                batchBusy ? "border-red-300 text-red-400" :
                                "border-blue-300 text-blue-400"
                              }`}>
                                {teacherNotAvailable ? "Not available" :
                                 teacherBusy ? "Teacher busy" :
                                 batchBusy ? "Batch busy" :
                                 "Drop here"}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Sidebar: Assignment Cards ─── */}
          <div className="w-full lg:w-72 lg:flex-shrink-0 order-first lg:order-last">
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-md p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-160px)] overflow-y-auto">
              <h3 className="font-semibold text-slate-900 text-sm mb-3">Teaching Assignments</h3>
              <p className="text-[10px] text-slate-400 mb-3">Drag cards to the grid to schedule</p>

              {batchAssignments.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No assignments for this batch.
                  <br />
                  <a href="/teaching-assignments" className="text-blue-500 hover:underline">Create assignments first</a>
                </p>
              ) : (
                <div className="space-y-2">
                  {batchAssignments.map((a) => {
                    const scheduled = getScheduledSlots(a.teacherId, a.subjectId, a.batchId);
                    const needed = a.slotsPerWeek;
                    const done = scheduled >= needed;
                    const colorClass = SUBJECT_COLORS[a.subject.code] || "bg-slate-50 border-slate-200";
                    const weekLoad = getTeacherWeeklyLoad(a.teacherId);

                    return (
                      <div
                        key={a.id}
                        draggable={!done}
                        onDragStart={() =>
                          handleDragStart({
                            teacherId: a.teacherId,
                            teacherName: a.teacher.user.name,
                            subjectId: a.subjectId,
                            subjectCode: a.subject.code,
                            batchId: a.batchId,
                            batchName: a.batch.name,
                          })
                        }
                        onDragEnd={handleDragEnd}
                        className={`${colorClass} border rounded-lg p-2.5 ${
                          done ? "opacity-50 cursor-not-allowed" : "cursor-grab active:cursor-grabbing hover:shadow-md"
                        } transition-all duration-200`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-xs">{a.subject.code} - {a.subject.name}</div>
                            <div className="text-[11px] opacity-70">{a.teacher.user.name}</div>
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            done ? "bg-emerald-50 text-emerald-700" : "bg-yellow-100 text-yellow-700"
                          }`}>
                            {scheduled}/{needed}
                          </span>
                        </div>
                        <div className="flex justify-between mt-1.5">
                          <div className="text-[10px] opacity-50">
                            {a.hoursPerWeek}h/week
                          </div>
                          <div className="text-[10px] opacity-50">
                            Load: {weekLoad} slots
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-1.5 h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${done ? "bg-green-500" : "bg-yellow-500"}`}
                            style={{ width: `${Math.min(100, (scheduled / Math.max(1, needed)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* All teachers overview */}
              <div className="mt-4 pt-3 border-t border-slate-200">
                <h4 className="font-medium text-slate-700 text-xs mb-2">Teacher Load This Week</h4>
                <div className="space-y-1">
                  {teachers
                    .filter((t) => getTeacherWeeklyLoad(t.id) > 0)
                    .sort((a, b) => getTeacherWeeklyLoad(b.id) - getTeacherWeeklyLoad(a.id))
                    .map((t) => (
                      <div key={t.id} className="flex justify-between text-[11px]">
                        <span className="text-slate-600 truncate">{t.user.name}</span>
                        <span className="text-slate-900 font-medium ml-2">{getTeacherWeeklyLoad(t.id)} slots</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
