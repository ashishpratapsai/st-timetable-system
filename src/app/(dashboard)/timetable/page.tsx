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
  classType: string;
  batch: { id: string; name: string; batchType: string };
  subject: { id: string; name: string; code: string };
  teacher: { id: string; user: { name: string } };
  substituteTeacher: { id: string; user: { name: string } } | null;
  classroom: { id: string; name: string; center: { name: string } };
}

interface Center { id: string; name: string; }
interface TimeSlot { id: string; startTime: string; endTime: string; label: string; order: number; }

const SUBJECT_COLORS: Record<string, string> = {
  PHY: "bg-blue-50 text-blue-800 border-blue-200",
  CHE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MAT: "bg-violet-50 text-violet-700 border-violet-200",
  BIO: "bg-amber-50 text-amber-700 border-amber-200",
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
      return "bg-rose-50 text-red-400 border-red-200 line-through";
    }
    if (entry.status === "SUBSTITUTED") {
      return "bg-amber-50 text-amber-800 border-amber-300";
    }
    return SUBJECT_COLORS[entry.subject.code] || "bg-slate-100 text-slate-800 border-slate-200";
  }

  const weekDates = getWeekDates();

  // Stats
  const scheduledCount = entries.filter((e) => e.status === "SCHEDULED").length;
  const substitutedCount = entries.filter((e) => e.status === "SUBSTITUTED").length;
  const cancelledCount = entries.filter((e) => e.status === "CANCELLED").length;

  return (
    <div>
      <Header title="Timetable" />
      <div className="p-6 animate-fadeIn">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Timetable</h1>
            <div className="flex gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                {scheduledCount} scheduled
              </span>
              {substitutedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  {substitutedCount} substituted
                </span>
              )}
              {cancelledCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-red-50 text-red-600 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  {cancelledCount} cancelled
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-3">
              <a href="/timetable/manual"
                className="bg-white text-slate-700 border border-slate-300 px-5 py-2.5 rounded-lg hover:bg-slate-50 hover:shadow-md transition-all duration-200 text-sm font-medium">
                Manual Editor
              </a>
              <button onClick={handleGenerate} disabled={generating}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2.5 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                {generating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Generating with AI...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
                    Generate with AI
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Week</label>
            <input type="date" value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Center</label>
            <select value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200">
              <option value="">All Centers</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">View</label>
            <div className="flex border border-slate-300 rounded-lg overflow-hidden">
              {(["center", "teacher", "batch"] as const).map((v) => (
                <button key={v} onClick={() => setViewBy(v)}
                  className={`px-3 py-2 text-sm capitalize ${viewBy === v ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Export</label>
            <button
              onClick={() => {
                const params = new URLSearchParams({ weekStart: selectedWeek });
                if (selectedCenter) params.set("centerId", selectedCenter);
                window.open(`/api/timetable/export-pdf?${params}`, "_blank");
              }}
              className="bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 hover:shadow-md transition-all duration-200 text-sm font-medium flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              Export PDF
            </button>
          </div>
        </div>

        {/* Legend */}
        {(substitutedCount > 0 || cancelledCount > 0) && (
          <div className="flex gap-4 mb-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-50 border border-amber-300"></div>
              <span className="text-slate-600">Substituted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-rose-50 border border-red-200"></div>
              <span className="text-slate-600">Cancelled</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 space-y-4">
            <div className="h-10 skeleton w-full max-w-2xl mx-auto" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-75" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-50" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/70 shadow">
            <p className="text-slate-400 text-lg mb-2">No timetable for this week</p>
            {isAdmin && (
              <p className="text-slate-400 text-sm">
                Click &quot;Generate Timetable with AI&quot; to create one
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow overflow-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50/80 w-32">
                    Time
                  </th>
                  {weekDates.map(({ day, date }, i) => (
                    <th key={i} className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[140px]">
                      <div>{day}</div>
                      <div className="text-xs text-slate-400">{date}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot) => (
                  <tr key={slot.id} className="border-b border-slate-100">
                    <td className="px-4 py-2 text-xs font-medium text-slate-500 sticky left-0 bg-white whitespace-nowrap">
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
                                <div className="font-semibold">
                                  {e.subject.code}
                                  {e.classType === "REVISION" && (
                                    <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded ml-1">R</span>
                                  )}
                                  {e.classType === "DOUBT" && (
                                    <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded ml-1">D</span>
                                  )}
                                </div>
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
