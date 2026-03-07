"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/header";
import { DAYS_OF_WEEK } from "@/lib/utils";
import { format, startOfWeek, addDays } from "date-fns";

interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  status: string;
  batch: { id: string; name: string; batchType: string };
  subject: { id: string; name: string; code: string };
  teacher: { id: string; user: { name: string } };
  substituteTeacher: { id: string; user: { name: string } } | null;
  classroom: { id: string; name: string; center: { name: string } };
}

interface Center { id: string; name: string; }
interface TimeSlot { id: string; startTime: string; endTime: string; label: string; order: number; }

const SUBJECT_COLORS: Record<string, string> = {
  PHY: "bg-blue-100 text-blue-800 border-blue-200",
  CHE: "bg-green-100 text-green-800 border-green-200",
  MAT: "bg-purple-100 text-purple-800 border-purple-200",
  BIO: "bg-orange-100 text-orange-800 border-orange-200",
  ENG: "bg-pink-100 text-pink-800 border-pink-200",
};

export default function TimetablePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  });
  const [selectedCenter, setSelectedCenter] = useState("");
  const [viewBy, setViewBy] = useState<"center" | "teacher" | "batch">("center");

  async function fetchData() {
    setLoading(true);
    const params = new URLSearchParams({ weekStart: selectedWeek });
    if (selectedCenter) params.set("centerId", selectedCenter);

    const [e, c, s] = await Promise.all([
      fetch(`/api/timetable/entries?${params}`).then((r) => r.json()),
      fetch("/api/centers").then((r) => r.json()),
      fetch("/api/time-slots").then((r) => r.json()),
    ]);
    setEntries(e);
    setCenters(c);
    setTimeSlots(s);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [selectedWeek, selectedCenter]);

  async function handleGenerate() {
    if (!confirm("Generate a new timetable? This will replace any existing timetable for this week.")) return;

    setGenerating(true);
    try {
      const res = await fetch("/api/timetable/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerId: selectedCenter || null, weekStart: selectedWeek }),
      });

      const data = await res.json();

      if (data.error) {
        alert(`Error: ${data.error}`);
        setGenerating(false);
        return;
      }

      if (data.conflicts && data.conflicts.length > 0) {
        const proceed = confirm(
          `Generated ${data.entries.length} entries with ${data.conflicts.length} conflicts:\n\n${data.conflicts.slice(0, 5).join("\n")}\n\nSave anyway?`
        );
        if (!proceed) {
          setGenerating(false);
          return;
        }
      }

      // Save entries
      await fetch("/api/timetable/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: data.entries, weekStart: selectedWeek }),
      });

      alert(data.message);
      fetchData();
    } catch (err) {
      alert(`Failed to generate: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setGenerating(false);
  }

  function getWeekDates() {
    const start = new Date(selectedWeek);
    return DAYS_OF_WEEK.slice(0, 6).map((day, i) => ({
      day,
      date: format(addDays(start, i), "MMM d"),
    }));
  }

  function getEntriesForSlot(day: number, startTime: string) {
    return entries.filter((e) => e.dayOfWeek === day && e.startTime === startTime);
  }

  function getEntryStyle(entry: TimetableEntry) {
    if (entry.status === "CANCELLED") {
      return "bg-red-50 text-red-400 border-red-200 line-through";
    }
    if (entry.status === "SUBSTITUTED") {
      return "bg-amber-50 text-amber-800 border-amber-300";
    }
    return SUBJECT_COLORS[entry.subject.code] || "bg-gray-100 text-gray-800 border-gray-200";
  }

  const weekDates = getWeekDates();

  // Stats
  const scheduledCount = entries.filter((e) => e.status === "SCHEDULED").length;
  const substitutedCount = entries.filter((e) => e.status === "SUBSTITUTED").length;
  const cancelledCount = entries.filter((e) => e.status === "CANCELLED").length;

  return (
    <div>
      <Header title="Timetable" />
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Timetable</h1>
            <div className="flex gap-3 mt-1">
              <span className="text-gray-500 text-sm">{scheduledCount} scheduled</span>
              {substitutedCount > 0 && (
                <span className="text-amber-600 text-sm">{substitutedCount} substituted</span>
              )}
              {cancelledCount > 0 && (
                <span className="text-red-500 text-sm">{cancelledCount} cancelled</span>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-3">
              <a href="/timetable/manual"
                className="bg-white text-gray-700 border border-gray-300 px-5 py-2.5 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                Manual Editor
              </a>
              <button onClick={handleGenerate} disabled={generating}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
                {generating ? "Generating with AI..." : "Generate Timetable with AI"}
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Week</label>
            <input type="date" value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Center</label>
            <select value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">All Centers</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">View</label>
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              {(["center", "teacher", "batch"] as const).map((v) => (
                <button key={v} onClick={() => setViewBy(v)}
                  className={`px-3 py-2 text-sm capitalize ${viewBy === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        {(substitutedCount > 0 || cancelledCount > 0) && (
          <div className="flex gap-4 mb-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-50 border border-amber-300"></div>
              <span className="text-gray-600">Substituted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-50 border border-red-200"></div>
              <span className="text-gray-600">Cancelled</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading timetable...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 text-lg mb-2">No timetable for this week</p>
            {isAdmin && (
              <p className="text-gray-400 text-sm">
                Click &quot;Generate Timetable with AI&quot; to create one
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 sticky left-0 bg-gray-50 w-32">
                    Time
                  </th>
                  {weekDates.map(({ day, date }, i) => (
                    <th key={i} className="text-center px-2 py-3 text-sm font-medium text-gray-500 min-w-[140px]">
                      <div>{day}</div>
                      <div className="text-xs text-gray-400">{date}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot) => (
                  <tr key={slot.id} className="border-b border-gray-100">
                    <td className="px-4 py-2 text-xs font-medium text-gray-500 sticky left-0 bg-white whitespace-nowrap">
                      {slot.startTime} - {slot.endTime}
                    </td>
                    {weekDates.map((_, dayIndex) => {
                      const slotEntries = getEntriesForSlot(dayIndex, slot.startTime);
                      return (
                        <td key={dayIndex} className="px-1 py-1">
                          {slotEntries.map((e) => {
                            const styleClass = getEntryStyle(e);
                            return (
                              <div key={e.id}
                                className={`${styleClass} border rounded-lg p-2 text-xs mb-1`}>
                                <div className="font-semibold">{e.subject.code}</div>
                                <div className="text-[10px] opacity-80">{e.batch.name}</div>

                                {e.status === "SUBSTITUTED" && e.substituteTeacher ? (
                                  <div className="text-[10px]">
                                    <span className="line-through opacity-50">{e.teacher.user.name}</span>
                                    <div className="font-medium text-amber-700">
                                      Sub: {e.substituteTeacher.user.name}
                                    </div>
                                  </div>
                                ) : e.status === "CANCELLED" ? (
                                  <div className="text-[10px] text-red-500 font-medium">Cancelled</div>
                                ) : (
                                  <div className="text-[10px] opacity-70">{e.teacher.user.name}</div>
                                )}

                                <div className="text-[10px] opacity-60">{e.classroom.name}</div>
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
