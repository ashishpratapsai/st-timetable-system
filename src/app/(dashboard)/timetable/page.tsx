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

interface UnscheduledItem {
  teacherName: string;
  batchName: string;
  subjectName: string;
  day: number;
  reason: string;
}

interface Center { id: string; name: string; }
interface TimeSlot { id: string; startTime: string; endTime: string; label: string; order: number; scope: string; }
interface BatchOption { id: string; name: string; batchType: string; }
interface TeacherOption { id: string; name: string; }

interface ValidationIssue {
  type: "error" | "warning" | "info";
  category: string;
  message: string;
  teacherName?: string;
  suggestion?: string;
}

interface TimetableVersion {
  id: string;
  label: string;
  scope: string | null;
  isActive: boolean;
  entryCount: number;
  createdAt: string;
  status: string;
}

type Scope = "senior" | "junior" | "all";
const SENIOR_BATCH_TYPES = ["IIT_JEE", "JEE_MAINS", "NEET"];

// Guided questionnaire options for AI generation
interface GeneratePreferences {
  consecutiveSlots: "2" | "3" | "custom";
  saturdayLoad: "normal" | "light" | "off";
  teacherPreferences: string;
  subjectSpread: "spread" | "cluster";
  additionalNotes: string;
}

const DEFAULT_PREFERENCES: GeneratePreferences = {
  consecutiveSlots: "2",
  saturdayLoad: "normal",
  teacherPreferences: "",
  subjectSpread: "spread",
  additionalNotes: "",
};

const SUBJECT_COLORS: Record<string, string> = {
  PHY: "bg-blue-50 text-blue-800 border-blue-200",
  CHE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MAT: "bg-violet-50 text-violet-700 border-violet-200",
  BIO: "bg-amber-50 text-amber-700 border-amber-200",
  ENG: "bg-pink-100 text-pink-800 border-pink-200",
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedScope, setSelectedScope] = useState<Scope>("all");
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  // Generate modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatePrefs, setGeneratePrefs] = useState<GeneratePreferences>({ ...DEFAULT_PREFERENCES });

  // Unscheduled items from last generation
  const [unscheduledItems, setUnscheduledItems] = useState<UnscheduledItem[]>([]);
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  // Pre-validation state
  const [validating, setValidating] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [overriddenIssues, setOverriddenIssues] = useState<Set<number>>(new Set());

  // Version management state
  const [versions, setVersions] = useState<TimetableVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [compareEntries, setCompareEntries] = useState<TimetableEntry[]>([]);
  const [settingActive, setSettingActive] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    const params = new URLSearchParams({ weekStart: selectedWeek });
    if (selectedCenter) params.set("centerId", selectedCenter);
    // If viewing a specific version, pass versionId
    if (selectedVersionId) params.set("versionId", selectedVersionId);

    const [e, c, s, b, t, v] = await Promise.all([
      fetch(`/api/timetable/entries?${params}`).then((r) => r.json()),
      fetch("/api/centers").then((r) => r.json()),
      fetch("/api/time-slots").then((r) => r.json()),
      fetch("/api/batches").then((r) => r.json()),
      fetch("/api/teachers").then((r) => r.json()),
      fetch(`/api/timetable/versions?weekStart=${selectedWeek}`).then((r) => r.json()).catch(() => []),
    ]);
    setEntries(e);
    setCenters(c);
    setTimeSlots(s);
    setBatches((b || []).map((batch: { id: string; name: string; batchType: string }) => ({ id: batch.id, name: batch.name, batchType: batch.batchType })));
    setTeachers((t || []).map((teacher: { id: string; user: { name: string } }) => ({ id: teacher.id, name: teacher.user.name })));
    setVersions(Array.isArray(v) ? v : []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [selectedWeek, selectedCenter, selectedVersionId]);

  // Filter entries based on scope + selected batch AND/OR teacher
  const filteredEntries = entries.filter((e) => {
    if (selectedScope === "senior" && !SENIOR_BATCH_TYPES.includes(e.batch.batchType)) return false;
    if (selectedScope === "junior" && SENIOR_BATCH_TYPES.includes(e.batch.batchType)) return false;
    if (selectedBatch && e.batch.id !== selectedBatch) return false;
    if (selectedTeacher && e.teacher.id !== selectedTeacher) return false;
    return true;
  });

  // Filter batch/teacher dropdowns by scope
  const scopedBatches = batches.filter((b) => {
    if (selectedScope === "senior") return SENIOR_BATCH_TYPES.includes(b.batchType);
    if (selectedScope === "junior") return !SENIOR_BATCH_TYPES.includes(b.batchType);
    return true;
  });
  const scopedTeacherIds = new Set(
    filteredEntries.map((e) => e.teacher.id)
  );
  const scopedTeachers = selectedScope === "all"
    ? teachers
    : teachers.filter((t) => scopedTeacherIds.has(t.id));

  // Scope-aware time slot filtering
  const filteredSlots = timeSlots.filter((s) =>
    selectedScope === "all" || s.scope === "all" || s.scope === selectedScope
  );

  // Active version info
  const activeVersion = versions.find((v) => v.isActive);
  const viewingVersion = selectedVersionId
    ? versions.find((v) => v.id === selectedVersionId)
    : activeVersion;

  function openGenerateModal() {
    setGeneratePrefs({ ...DEFAULT_PREFERENCES });
    setShowGenerateModal(true);
  }

  function buildPromptFromPreferences(prefs: GeneratePreferences): string {
    const parts: string[] = [];

    // Consecutive slots
    if (prefs.consecutiveSlots === "2") {
      parts.push("Schedule 2 consecutive slots (3 hours) for each teacher-batch pair per day whenever possible.");
    } else if (prefs.consecutiveSlots === "3") {
      parts.push("Schedule 3 consecutive slots (4.5 hours) for each teacher-batch pair per day whenever possible.");
    }

    // Saturday
    if (prefs.saturdayLoad === "light") {
      parts.push("Keep Saturday light — schedule fewer classes and give teachers a shorter day.");
    } else if (prefs.saturdayLoad === "off") {
      parts.push("Do NOT schedule any classes on Saturday.");
    }

    // Subject spread
    if (prefs.subjectSpread === "cluster") {
      parts.push("Cluster same subjects on the same day when possible (e.g., all Physics on Mon/Wed).");
    } else {
      parts.push("Spread each subject across different days for better learning retention.");
    }

    // Teacher preferences
    if (prefs.teacherPreferences.trim()) {
      parts.push(prefs.teacherPreferences.trim());
    }

    // Additional notes
    if (prefs.additionalNotes.trim()) {
      parts.push(prefs.additionalNotes.trim());
    }

    return parts.join("\n");
  }

  // Step 1: After questionnaire, run validation first
  async function handlePreValidate() {
    setShowGenerateModal(false);
    setValidating(true);
    setOverriddenIssues(new Set());

    try {
      // Save custom prompt first so validation can use it
      const builtPrompt = buildPromptFromPreferences(generatePrefs);
      await Promise.all([
        fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "ai_custom_prompt", value: builtPrompt }),
        }),
        fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "consecutive_slots", value: generatePrefs.consecutiveSlots }),
        }),
      ]);

      const res = await fetch("/api/timetable/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          centerId: selectedCenter || null,
          weekStart: selectedWeek,
          scope: selectedScope,
          mode: "validate",
        }),
      });
      const data = await res.json();

      if (data.error) {
        alert(`Validation error: ${data.error}`);
        setValidating(false);
        return;
      }

      const issues: ValidationIssue[] = data.issues || [];
      setValidationIssues(issues);

      // If no errors (only warnings/info), go straight to generation
      const hasErrors = issues.some((i) => i.type === "error");
      if (!hasErrors && issues.length <= 3) {
        // Few/no issues — proceed directly
        setValidating(false);
        await handleGenerate();
      } else {
        // Show validation modal for review
        setValidating(false);
        setShowValidationModal(true);
      }
    } catch (err) {
      alert(`Validation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setValidating(false);
    }
  }

  // Step 2: Actual generation (called after validation passes or admin overrides)
  async function handleGenerate() {
    setShowValidationModal(false);
    setGenerating(true);
    setUnscheduledItems([]);

    try {
      const res = await fetch("/api/timetable/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerId: selectedCenter || null, weekStart: selectedWeek, scope: selectedScope }),
      });

      const data = await res.json();

      if (data.error) {
        alert(`Error: ${data.error}`);
        setGenerating(false);
        return;
      }

      // Save entries (guaranteed conflict-free by the algorithm)
      if (data.entries && data.entries.length > 0) {
        const saveRes = await fetch("/api/timetable/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: data.entries, weekStart: selectedWeek, scope: selectedScope }),
        });
        const saveData = await saveRes.json();
        if (saveData.versionLabel) {
          alert(`${data.message}\nSaved as: ${saveData.versionLabel}`);
        } else {
          alert(data.message);
        }
      } else {
        alert(data.message || "No entries generated.");
      }

      // Store unscheduled items
      if (data.unscheduled && data.unscheduled.length > 0) {
        setUnscheduledItems(data.unscheduled);
        setShowUnscheduled(true);
      }

      // Reset version selection to show active
      setSelectedVersionId(null);
      fetchData();
    } catch (err) {
      alert(`Failed to generate: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setGenerating(false);
  }

  // Version management functions
  async function handleSetActiveVersion(versionId: string) {
    setSettingActive(true);
    try {
      const res = await fetch("/api/timetable/versions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        setSelectedVersionId(null);
        fetchData();
      }
    } catch {
      alert("Failed to set active version");
    }
    setSettingActive(false);
  }

  async function handleDeleteVersion(versionId: string) {
    if (!confirm("Delete this version? This cannot be undone.")) return;
    setDeletingVersion(versionId);
    try {
      const res = await fetch(`/api/timetable/versions?versionId=${versionId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        if (selectedVersionId === versionId) setSelectedVersionId(null);
        fetchData();
      }
    } catch {
      alert("Failed to delete version");
    }
    setDeletingVersion(null);
  }

  async function handleStartCompare(versionId: string) {
    setCompareVersionId(versionId);
    setShowCompare(true);
    try {
      const params = new URLSearchParams({ weekStart: selectedWeek, versionId });
      const res = await fetch(`/api/timetable/entries?${params}`);
      const data = await res.json();
      setCompareEntries(Array.isArray(data) ? data : []);
    } catch {
      setCompareEntries([]);
    }
  }

  function getWeekDates() {
    const start = new Date(selectedWeek);
    return DAYS_OF_WEEK.slice(0, 7).map((day, i) => ({
      day,
      date: format(addDays(start, i), "MMM d"),
    }));
  }

  function getEntriesForSlot(day: number, startTime: string) {
    return filteredEntries.filter((e) => e.dayOfWeek === day && e.startTime === startTime);
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

  // Stats (based on filtered view)
  const scheduledCount = filteredEntries.filter((e) => e.status === "SCHEDULED").length;
  const substitutedCount = filteredEntries.filter((e) => e.status === "SUBSTITUTED").length;
  const cancelledCount = filteredEntries.filter((e) => e.status === "CANCELLED").length;

  return (
    <div>
      <Header title="Timetable" />
      <div className="p-3 sm:p-4 md:p-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Timetable</h1>
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
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <a href="/timetable/manual"
                className="bg-white text-slate-700 border border-slate-300 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg hover:bg-slate-50 hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium flex-1 sm:flex-initial text-center">
                Manual Editor
              </a>
              <button onClick={openGenerateModal} disabled={generating || validating}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-xs sm:text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 flex-1 sm:flex-initial">
                {generating || validating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    {validating ? "Validating..." : "Generating..."}
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

        {/* Scope Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
          {([
            { val: "all" as Scope, label: "All" },
            { val: "senior" as Scope, label: "Senior (11th-12th)" },
            { val: "junior" as Scope, label: "Junior (8th-10th)" },
          ]).map((tab) => (
            <button
              key={tab.val}
              onClick={() => { setSelectedScope(tab.val); setSelectedBatch(""); setSelectedTeacher(""); }}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                selectedScope === tab.val
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200/70 rounded-xl p-3 sm:p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-2 sm:flex sm:gap-4 sm:flex-wrap sm:items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Week</label>
              <input type="date" value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Center</label>
              <select value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200">
                <option value="">All Centers</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="h-8 w-px bg-slate-200 self-center hidden sm:block" />

            <div>
              <label className="block text-xs font-medium text-blue-600 mb-1">Filter by Batch</label>
              <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 sm:min-w-[180px] ${selectedBatch ? "border-blue-400 bg-blue-50 text-blue-800 font-medium" : "border-slate-300"}`}>
                <option value="">All Batches</option>
                {scopedBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-600 mb-1">Filter by Teacher</label>
              <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 sm:min-w-[180px] ${selectedTeacher ? "border-blue-400 bg-blue-50 text-blue-800 font-medium" : "border-slate-300"}`}>
                <option value="">All Teachers</option>
                {scopedTeachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {(selectedBatch || selectedTeacher) && (
              <button
                onClick={() => { setSelectedBatch(""); setSelectedTeacher(""); }}
                className="px-3 py-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all duration-200 w-full sm:w-auto"
              >
                Clear Filters
              </button>
            )}

            <div className="col-span-1 sm:ml-auto">
              <label className="block text-xs font-medium text-slate-500 mb-1">Export</label>
              <button
                onClick={() => {
                  const params = new URLSearchParams({ weekStart: selectedWeek });
                  if (selectedCenter) params.set("centerId", selectedCenter);
                  window.open(`/api/timetable/export-pdf?${params}`, "_blank");
                }}
                className="bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 hover:shadow-md transition-all duration-200 text-sm font-medium flex items-center gap-1.5 w-full sm:w-auto justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                PDF
              </button>
            </div>
          </div>
          {/* Active filter summary */}
          {(selectedBatch || selectedTeacher) && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" /></svg>
              <span>Showing:</span>
              {selectedBatch && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {batches.find(b => b.id === selectedBatch)?.name || "Selected Batch"}
                  <button onClick={() => setSelectedBatch("")} className="hover:text-blue-900">×</button>
                </span>
              )}
              {selectedTeacher && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {teachers.find(t => t.id === selectedTeacher)?.name || "Selected Teacher"}
                  <button onClick={() => setSelectedTeacher("")} className="hover:text-blue-900">×</button>
                </span>
              )}
              <span className="text-slate-400">({filteredEntries.length} entries)</span>
            </div>
          )}
        </div>

        {/* Unscheduled Items Warning */}
        {unscheduledItems.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span className="text-sm font-medium text-amber-800">
                  {unscheduledItems.length} class{unscheduledItems.length > 1 ? "es" : ""} could not be auto-scheduled
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUnscheduled(!showUnscheduled)}
                  className="text-xs text-amber-700 hover:text-amber-900 font-medium"
                >
                  {showUnscheduled ? "Hide Details" : "Show Details"}
                </button>
                <button
                  onClick={() => setUnscheduledItems([])}
                  className="text-xs text-amber-500 hover:text-amber-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
            {showUnscheduled && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs text-amber-600 mb-2">Use the Manual Editor to schedule these classes:</p>
                {unscheduledItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs bg-white/60 rounded-lg px-3 py-2">
                    <span className="font-medium text-amber-800 whitespace-nowrap">
                      {DAY_NAMES[item.day]}:
                    </span>
                    <span className="text-amber-700">
                      {item.teacherName} → {item.batchName} → {item.subjectName}
                    </span>
                    <span className="text-amber-500 ml-auto whitespace-nowrap">
                      {item.reason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Version Selector */}
        {versions.length > 0 && isAdmin && (
          <div className="mb-4 bg-white border border-slate-200/70 rounded-xl p-3 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-sm font-semibold text-slate-700">Versions ({versions.length}/5)</span>
              </div>
              {showCompare && (
                <button onClick={() => { setShowCompare(false); setCompareVersionId(null); setCompareEntries([]); }}
                  className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
                  Exit Compare
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {versions.map((v) => {
                const isViewing = selectedVersionId === v.id || (!selectedVersionId && v.isActive);
                const isComparing = compareVersionId === v.id;
                return (
                  <div key={v.id}
                    className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 cursor-pointer ${
                      isComparing
                        ? "border-purple-400 bg-purple-50 text-purple-700"
                        : isViewing
                          ? "border-blue-400 bg-blue-50 text-blue-700 shadow-sm"
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      if (showCompare && !isViewing) {
                        handleStartCompare(v.id);
                      } else {
                        setSelectedVersionId(v.isActive ? null : v.id);
                        setShowCompare(false);
                        setCompareVersionId(null);
                      }
                    }}
                  >
                    {v.label || "Untitled"}
                    {v.isActive && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                        <span className="w-1 h-1 rounded-full bg-green-500" />
                        Active
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{v.entryCount} entries</span>

                    {/* Actions on hover */}
                    <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                      {!v.isActive && !showCompare && (
                        <button
                          onClick={(evt) => { evt.stopPropagation(); handleSetActiveVersion(v.id); }}
                          disabled={settingActive}
                          className="p-0.5 rounded text-green-600 hover:bg-green-100 transition-colors"
                          title="Set as active"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        </button>
                      )}
                      {!v.isActive && (
                        <button
                          onClick={(evt) => { evt.stopPropagation(); handleDeleteVersion(v.id); }}
                          disabled={deletingVersion === v.id}
                          className="p-0.5 rounded text-red-500 hover:bg-red-100 transition-colors"
                          title="Delete version"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      )}
                      {!showCompare && versions.length > 1 && (
                        <button
                          onClick={(evt) => {
                            evt.stopPropagation();
                            // Start compare: current view is "A", click another for "B"
                            setSelectedVersionId(v.isActive ? null : v.id);
                            setShowCompare(true);
                            setCompareVersionId(null);
                            setCompareEntries([]);
                          }}
                          className="p-0.5 rounded text-purple-600 hover:bg-purple-100 transition-colors"
                          title="Compare with another version"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {showCompare && !compareVersionId && (
              <p className="mt-2 text-xs text-purple-600 animate-pulse">
                👆 Click another version to compare with the current view
              </p>
            )}
            {/* Viewing non-active version banner */}
            {viewingVersion && !viewingVersion.isActive && (
              <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                Viewing: <strong>{viewingVersion.label}</strong> (not active)
                <button onClick={() => setSelectedVersionId(null)} className="ml-auto text-amber-600 hover:text-amber-800 font-medium">
                  Back to active
                </button>
              </div>
            )}
          </div>
        )}

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

        {/* Compare mode summary */}
        {showCompare && compareVersionId && compareEntries.length > 0 && (
          <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-purple-800">Comparison View</span>
              <div className="flex gap-3 text-xs">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-200" />
                  Only in current ({filteredEntries.filter((e) => !compareEntries.some((ce) => ce.batch.id === e.batch.id && ce.teacher.id === e.teacher.id && ce.dayOfWeek === e.dayOfWeek && ce.startTime === e.startTime)).length})
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-green-100 border border-green-200" />
                  Only in compare ({compareEntries.filter((ce) => !filteredEntries.some((e) => e.batch.id === ce.batch.id && e.teacher.id === ce.teacher.id && e.dayOfWeek === ce.dayOfWeek && e.startTime === ce.startTime)).length})
                </span>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-purple-600">
              <span>Current: <strong>{viewingVersion?.label || "Active"}</strong> — {filteredEntries.length} entries</span>
              <span>Compare: <strong>{versions.find((v) => v.id === compareVersionId)?.label || "?"}</strong> — {compareEntries.length} entries</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 space-y-4">
            <div className="h-10 skeleton w-full max-w-2xl mx-auto" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-75" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-50" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/70 shadow">
            {entries.length > 0 ? (
              <div>
                <p className="text-slate-400 text-lg mb-2">
                  No entries found for the selected filter
                </p>
                <p className="text-slate-400 text-sm">
                  Try selecting a different batch/teacher or click &quot;Clear Filters&quot;
                </p>
              </div>
            ) : (
              <div>
                <p className="text-slate-400 text-lg mb-2">No timetable for this week</p>
                {isAdmin && (
                  <p className="text-slate-400 text-sm">
                    Click &quot;Generate with AI&quot; to create one
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="-mx-3 sm:mx-0 bg-white sm:rounded-2xl border border-slate-200/70 shadow overflow-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50/80 w-24 sm:w-32">
                    Time
                  </th>
                  {weekDates.map(({ day, date }, i) => (
                    <th key={i} className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px] sm:min-w-[140px]">
                      <div>{day}</div>
                      <div className="text-xs text-slate-400">{date}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSlots.map((slot) => (
                  <tr key={slot.id} className="border-b border-slate-100">
                    <td className="px-3 sm:px-4 py-2 text-xs font-medium text-slate-500 sticky left-0 bg-white whitespace-nowrap">
                      {slot.startTime} - {slot.endTime}
                    </td>
                    {weekDates.map((_, dayIndex) => {
                      const slotEntries = getEntriesForSlot(dayIndex, slot.startTime);
                      // In compare mode, find entries from compare version for this cell
                      const compareSlotEntries = showCompare && compareVersionId
                        ? compareEntries.filter((ce) => ce.dayOfWeek === dayIndex && ce.startTime === slot.startTime)
                        : [];
                      // Determine diff highlights
                      const currentKeys = new Set(slotEntries.map((e) => `${e.batch.id}-${e.teacher.id}`));
                      const compareKeys = new Set(compareSlotEntries.map((e) => `${e.batch.id}-${e.teacher.id}`));
                      return (
                        <td key={dayIndex} className="px-1 py-1">
                          {slotEntries.map((e) => {
                            const key = `${e.batch.id}-${e.teacher.id}`;
                            const isRemoved = showCompare && compareVersionId && !compareKeys.has(key);
                            const styleClass = isRemoved
                              ? "bg-red-50 text-red-400 border-red-200"
                              : getEntryStyle(e);
                            return (
                              <div key={e.id}
                                className={`${styleClass} border rounded-lg p-2 text-xs mb-1 ${isRemoved ? "opacity-60" : ""}`}>
                                {isRemoved && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">Only in current</span>}
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
                          {/* Show entries only in compare version (new/added) */}
                          {compareSlotEntries
                            .filter((ce) => !currentKeys.has(`${ce.batch.id}-${ce.teacher.id}`))
                            .map((ce) => (
                              <div key={ce.id}
                                className="bg-green-50 text-green-700 border-green-200 border rounded-lg p-2 text-xs mb-1 opacity-75">
                                <span className="text-[9px] bg-green-100 text-green-600 px-1 rounded">Only in compare</span>
                                <div className="font-semibold">{ce.subject.code}</div>
                                <div className="text-[10px] opacity-80">{ce.batch.name}</div>
                                <div className="text-[10px] opacity-70">{ce.teacher.user.name}</div>
                                <div className="text-[10px] opacity-60">{ce.classroom.name}</div>
                              </div>
                            ))}
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

      {/* Pre-Validation Results Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Pre-Generation Check</h2>
                  <p className="text-xs text-slate-500">Review these findings before generating</p>
                </div>
              </div>

              {/* Group issues by type */}
              {(() => {
                const errors = validationIssues.filter((i) => i.type === "error");
                const warnings = validationIssues.filter((i) => i.type === "warning");
                const infos = validationIssues.filter((i) => i.type === "info");
                return (
                  <div className="space-y-4">
                    {errors.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500" /> Errors ({errors.length})
                        </h3>
                        <div className="space-y-2">
                          {errors.map((issue, idx) => {
                            const globalIdx = validationIssues.indexOf(issue);
                            const isOverridden = overriddenIssues.has(globalIdx);
                            return (
                              <div key={idx} className={`rounded-lg border p-3 transition-all ${isOverridden ? "border-slate-200 bg-slate-50 opacity-60" : "border-red-200 bg-red-50"}`}>
                                <p className={`text-sm ${isOverridden ? "text-slate-500 line-through" : "text-red-800"}`}>
                                  {issue.message}
                                </p>
                                {issue.teacherName && (
                                  <p className="text-xs text-red-500 mt-0.5">Teacher: {issue.teacherName}</p>
                                )}
                                {issue.suggestion && (
                                  <p className="text-xs text-red-600 mt-1 italic">{issue.suggestion}</p>
                                )}
                                {!isOverridden ? (
                                  <button
                                    onClick={() => setOverriddenIssues((prev) => new Set([...prev, globalIdx]))}
                                    className="mt-2 text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded transition-colors"
                                  >
                                    Override — Proceed Anyway
                                  </button>
                                ) : (
                                  <span className="mt-2 inline-block text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded">
                                    ✓ Overridden
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {warnings.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" /> Warnings ({warnings.length})
                        </h3>
                        <div className="space-y-2">
                          {warnings.map((issue, idx) => (
                            <div key={idx} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <p className="text-sm text-amber-800">{issue.message}</p>
                              {issue.teacherName && (
                                <p className="text-xs text-amber-500 mt-0.5">Teacher: {issue.teacherName}</p>
                              )}
                              {issue.suggestion && (
                                <p className="text-xs text-amber-600 mt-1 italic">{issue.suggestion}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {infos.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" /> Info
                        </h3>
                        <div className="space-y-2">
                          {infos.map((issue, idx) => (
                            <div key={idx} className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                              <p className="text-sm text-blue-800">{issue.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowValidationModal(false); setShowGenerateModal(true); }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200"
                >
                  ← Back to Questionnaire
                </button>
                <button
                  onClick={() => {
                    const unoverriddenErrors = validationIssues.filter((i, idx) => i.type === "error" && !overriddenIssues.has(idx));
                    if (unoverriddenErrors.length > 0) {
                      alert(`Please override or fix ${unoverriddenErrors.length} error(s) before proceeding.`);
                      return;
                    }
                    handleGenerate();
                  }}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                  Proceed with Generation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate with AI Modal — Guided Questionnaire */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Generate Timetable with AI</h2>
                  <p className="text-xs text-slate-500">Answer a few questions to customise your timetable</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
                <p className="text-xs text-amber-700">
                  {selectedScope === "senior" ? (
                    <><strong>Generating Senior (11th-12th) timetable only.</strong> Junior classes will not be affected. Previous versions are preserved.</>
                  ) : selectedScope === "junior" ? (
                    <><strong>Generating Junior (8th-10th) timetable only.</strong> Senior classes will not be affected. Previous versions are preserved.</>
                  ) : (
                    <><strong>Note:</strong> This will create a new version for the selected week. Previous versions are preserved for comparison. Zero conflicts guaranteed.</>
                  )}
                </p>
                {versions.length >= 5 && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    ⚠️ You have {versions.length} versions. Delete an old version before generating a new one.
                  </p>
                )}
              </div>

              {/* Q1: Consecutive Slots */}
              <div className="mb-4 sm:mb-5">
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  1. How many consecutive hours per batch?
                </label>
                <p className="text-xs text-slate-500 mb-2.5">
                  How long should a teacher teach the same batch continuously?
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  {([
                    { val: "2" as const, label: "3 Hours", desc: "2 slots back-to-back" },
                    { val: "3" as const, label: "4.5 Hours", desc: "3 slots back-to-back" },
                    { val: "custom" as const, label: "Auto", desc: "AI decides best split" },
                  ]).map((opt) => (
                    <button key={opt.val}
                      onClick={() => setGeneratePrefs((p) => ({ ...p, consecutiveSlots: opt.val }))}
                      className={`flex-1 p-2.5 sm:p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                        generatePrefs.consecutiveSlots === opt.val
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}>
                      <div className={`text-sm font-semibold ${generatePrefs.consecutiveSlots === opt.val ? "text-blue-700" : "text-slate-700"}`}>
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-slate-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q2: Saturday Load */}
              <div className="mb-4 sm:mb-5">
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  2. What about Saturday?
                </label>
                <p className="text-xs text-slate-500 mb-2.5">
                  How many classes should be scheduled on Saturday?
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  {([
                    { val: "normal" as const, label: "Full Day", desc: "Same as other days" },
                    { val: "light" as const, label: "Light Day", desc: "Fewer classes" },
                    { val: "off" as const, label: "No Classes", desc: "Saturday off" },
                  ]).map((opt) => (
                    <button key={opt.val}
                      onClick={() => setGeneratePrefs((p) => ({ ...p, saturdayLoad: opt.val }))}
                      className={`flex-1 p-2.5 sm:p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                        generatePrefs.saturdayLoad === opt.val
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}>
                      <div className={`text-sm font-semibold ${generatePrefs.saturdayLoad === opt.val ? "text-blue-700" : "text-slate-700"}`}>
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-slate-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q3: Subject Spread */}
              <div className="mb-4 sm:mb-5">
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  3. How to distribute subjects?
                </label>
                <p className="text-xs text-slate-500 mb-2.5">
                  Should same subjects be spread across days or clustered together?
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  {([
                    { val: "spread" as const, label: "Spread Out", desc: "Physics on Mon, Wed, Fri" },
                    { val: "cluster" as const, label: "Cluster", desc: "Physics mostly on Mon & Tue" },
                  ]).map((opt) => (
                    <button key={opt.val}
                      onClick={() => setGeneratePrefs((p) => ({ ...p, subjectSpread: opt.val }))}
                      className={`flex-1 p-2.5 sm:p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                        generatePrefs.subjectSpread === opt.val
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}>
                      <div className={`text-sm font-semibold ${generatePrefs.subjectSpread === opt.val ? "text-blue-700" : "text-slate-700"}`}>
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-slate-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q4: Teacher-specific instructions */}
              <div className="mb-4 sm:mb-5">
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  4. Any teacher-specific preferences? <span className="text-slate-400 font-normal text-xs">(optional)</span>
                </label>
                <p className="text-xs text-slate-500 mb-2.5">
                  E.g., &quot;Give Rajesh sir more Monday classes&quot; or &quot;Priya ma&apos;am prefers mornings&quot;
                </p>
                <textarea
                  value={generatePrefs.teacherPreferences}
                  onChange={(e) => setGeneratePrefs((p) => ({ ...p, teacherPreferences: e.target.value }))}
                  placeholder="Type any teacher-specific requests here..."
                  rows={2}
                  maxLength={300}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 resize-none placeholder:text-slate-400"
                />
              </div>

              {/* Q5: Additional Notes */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  5. Anything else? <span className="text-slate-400 font-normal text-xs">(optional)</span>
                </label>
                <p className="text-xs text-slate-500 mb-2.5">
                  Any other instructions for timetable generation
                </p>
                <textarea
                  value={generatePrefs.additionalNotes}
                  onChange={(e) => setGeneratePrefs((p) => ({ ...p, additionalNotes: e.target.value }))}
                  placeholder="E.g., No classes on Wednesday afternoon, keep gap between Physics and Chemistry..."
                  rows={2}
                  maxLength={300}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 resize-none placeholder:text-slate-400"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePreValidate}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                  Validate &amp; Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
