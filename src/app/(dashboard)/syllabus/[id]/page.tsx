"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Modal } from "@/components/modal";

interface SubtopicProgress {
  id: string;
  completedAt: string;
  teacher: { user: { name: string } };
  batch?: { id: string; name: string };
}

interface SubtopicItem {
  id: string;
  name: string;
  order: number;
  estimatedHours: number | null;
  progress: SubtopicProgress[];
}

interface ChapterAssignment {
  id: string;
  teacherId: string;
  batchId: string;
  teacher: { id: string; user: { name: string } };
  batch: { id: string; name: string; batchType: string };
}

interface ChapterItem {
  id: string;
  name: string;
  order: number;
  description: string | null;
  subtopics: SubtopicItem[];
  assignments: ChapterAssignment[];
}

interface SyllabusDetail {
  id: string;
  name: string;
  description: string | null;
  batchType: string;
  subject: { id: string; name: string; code: string };
  chapters: ChapterItem[];
}

interface TeacherOption {
  id: string;
  user: { name: string };
}

interface BatchOption {
  id: string;
  name: string;
  batchType: string;
}

interface ReportTeacher {
  teacherId: string;
  teacherName: string;
  batchId: string;
  batchName: string;
  assignedChapters: number;
  completedChapters: number;
  totalSubtopics: number;
  completedSubtopics: number;
  totalEstimatedHours: number;
  completedEstimatedHours: number;
  percentComplete: number;
  lastActivityDate: string | null;
}

const BATCH_LABELS: Record<string, string> = {
  IIT_JEE: "IIT-JEE", NEET: "NEET", JEE_MAINS: "JEE Mains",
  SCHOOL_8TH: "8th Standard", SCHOOL_9TH: "9th Standard", SCHOOL_10TH: "10th Standard",
};

export default function SyllabusDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [syllabus, setSyllabus] = useState<SyllabusDetail | null>(null);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [report, setReport] = useState<ReportTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"chapters" | "assignments" | "progress">("chapters");

  // Modals
  const [chapterModalOpen, setChapterModalOpen] = useState(false);
  const [subtopicModalOpen, setSubtopicModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  // Forms
  const [chapterForm, setChapterForm] = useState({ name: "", description: "" });
  const [editingChapter, setEditingChapter] = useState<ChapterItem | null>(null);
  const [subtopicForm, setSubtopicForm] = useState({ name: "", estimatedHours: "" });
  const [activeChapterId, setActiveChapterId] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState<{ name: string; subtopics: string[] }[]>([]);
  const [assignForm, setAssignForm] = useState({ teacherId: "", batchId: "", chapterIds: [] as string[] });

  // Expanded chapters
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function fetchData() {
    const [s, r, batchList] = await Promise.all([
      fetch(`/api/syllabus/${id}`).then((res) => res.json()),
      fetch(`/api/syllabus/reports?syllabusId=${id}`).then((res) => res.json()),
      fetch("/api/batches").then((res) => res.json()),
    ]);
    setSyllabus(s);
    setReport(r[0]?.teacherProgress || []);

    // Filter batches to match syllabus batchType
    if (s.batchType) {
      const matchingBatches = (batchList || []).filter((b: BatchOption) => b.batchType === s.batchType);
      setBatches(matchingBatches);
    }

    // Fetch subject-qualified teachers
    if (s.subject) {
      const allTeachers = await fetch("/api/teachers").then((res) => res.json());
      const qualified = allTeachers.filter((t: { subjects: { subjectId: string }[] }) =>
        t.subjects.some((ts: { subjectId: string }) => ts.subjectId === s.subject.id)
      );
      setTeachers(qualified);
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  function toggleExpand(chId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(chId) ? next.delete(chId) : next.add(chId);
      return next;
    });
  }

  // --- Chapter CRUD ---
  function openAddChapter() {
    setEditingChapter(null);
    setChapterForm({ name: "", description: "" });
    setChapterModalOpen(true);
  }

  function openEditChapter(ch: ChapterItem) {
    setEditingChapter(ch);
    setChapterForm({ name: ch.name, description: ch.description || "" });
    setChapterModalOpen(true);
  }

  async function handleChapterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingChapter) {
      await fetch(`/api/syllabus/${id}/chapters/${editingChapter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chapterForm),
      });
    } else {
      await fetch(`/api/syllabus/${id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chapterForm),
      });
    }
    setChapterModalOpen(false);
    fetchData();
  }

  async function handleDeleteChapter(chId: string) {
    if (!confirm("Delete this chapter and all its subtopics?")) return;
    await fetch(`/api/syllabus/${id}/chapters/${chId}`, { method: "DELETE" });
    fetchData();
  }

  // --- Subtopic CRUD ---
  function openAddSubtopic(chId: string) {
    setActiveChapterId(chId);
    setSubtopicForm({ name: "", estimatedHours: "" });
    setSubtopicModalOpen(true);
  }

  async function handleSubtopicSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/syllabus/${id}/chapters/${activeChapterId}/subtopics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: subtopicForm.name,
        estimatedHours: subtopicForm.estimatedHours ? parseFloat(subtopicForm.estimatedHours) : null,
      }),
    });
    setSubtopicModalOpen(false);
    fetchData();
  }

  async function handleDeleteSubtopic(chId: string, stId: string) {
    await fetch(`/api/syllabus/${id}/chapters/${chId}/subtopics/${stId}`, { method: "DELETE" });
    fetchData();
  }

  // --- Bulk Import ---
  function parseBulkText(text: string) {
    const lines = text.split("\n").filter((l) => l.trim());
    const chapters: { name: string; subtopics: string[] }[] = [];
    let current: { name: string; subtopics: string[] } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const isSubtopic = /^[\s\t]/.test(line) || /^[-•*]\s/.test(trimmed) || (/^\d+[\.\)]\s/.test(trimmed) && current);

      if (isSubtopic && current) {
        const name = trimmed.replace(/^[-•*\d\.\)]+\s*/, "").trim();
        if (name) current.subtopics.push(name);
      } else {
        const name = trimmed.replace(/^(Chapter\s*\d+[\s:.-]*|[\d]+[\.\)]\s*)/i, "").trim();
        if (name) {
          current = { name, subtopics: [] };
          chapters.push(current);
        }
      }
    }
    return chapters;
  }

  function handleBulkPreview() {
    const parsed = parseBulkText(bulkText);
    setBulkPreview(parsed);
  }

  async function handleBulkImport() {
    if (bulkPreview.length === 0) return;
    const res = await fetch(`/api/syllabus/${id}/bulk-import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapters: bulkPreview }),
    });
    const data = await res.json();
    alert(`Imported ${data.imported} chapters with ${data.totalSubtopics} subtopics`);
    setBulkModalOpen(false);
    setBulkText("");
    setBulkPreview([]);
    fetchData();
  }

  // --- Assignments ---
  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (assignForm.chapterIds.length === 0) {
      alert("Select at least one chapter");
      return;
    }
    if (!assignForm.batchId) {
      alert("Select a batch");
      return;
    }
    const res = await fetch(`/api/syllabus/${id}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assignForm),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    alert(`Assigned ${data.assigned} chapters`);
    setAssignModalOpen(false);
    fetchData();
  }

  async function handleUnassign(teacherId: string, chapterId: string, batchId: string) {
    await fetch(`/api/syllabus/${id}/assignments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId, chapterIds: [chapterId], batchId }),
    });
    fetchData();
  }

  function toggleChapterSelect(chId: string) {
    setAssignForm((prev) => ({
      ...prev,
      chapterIds: prev.chapterIds.includes(chId)
        ? prev.chapterIds.filter((c) => c !== chId)
        : [...prev.chapterIds, chId],
    }));
  }

  if (loading) {
    return (
      <div>
        <Header title="Syllabus" />
        <div className="p-6">
          <div className="py-12 space-y-4">
            <div className="h-10 skeleton w-full max-w-2xl mx-auto" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-75" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-50" />
          </div>
        </div>
      </div>
    );
  }

  if (!syllabus) {
    return (
      <div>
        <Header title="Syllabus" />
        <div className="p-6 text-center py-12 text-slate-500">Syllabus not found</div>
      </div>
    );
  }

  const totalSubtopics = syllabus.chapters.reduce((sum, ch) => sum + ch.subtopics.length, 0);
  const completedSubtopics = syllabus.chapters.reduce(
    (sum, ch) => sum + ch.subtopics.filter((st) => st.progress.length > 0).length, 0
  );
  const overallPercent = totalSubtopics > 0 ? Math.round((completedSubtopics / totalSubtopics) * 100) : 0;
  const totalEstHours = syllabus.chapters.reduce(
    (sum, ch) => sum + ch.subtopics.reduce((s2, st) => s2 + (st.estimatedHours || 0), 0), 0
  );

  return (
    <div>
      <Header title="Syllabus" />
      <div className="p-3 sm:p-4 md:p-6 animate-fadeIn">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <button onClick={() => router.push("/syllabus")} className="text-blue-600 hover:text-blue-700 transition-colors text-sm mb-2 inline-block">
              &larr; Back to Syllabi
            </button>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{syllabus.name}</h1>
            <div className="flex gap-2 mt-1 flex-wrap items-center">
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                {BATCH_LABELS[syllabus.batchType] || syllabus.batchType}
              </span>
              <span className="bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full text-xs font-medium">
                {syllabus.subject.code}
              </span>
              <span className="text-slate-500 text-sm">
                {syllabus.chapters.length} chapters, {totalSubtopics} subtopics, {overallPercent}% complete
              </span>
              {totalEstHours > 0 && (
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  {totalEstHours}h estimated
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-6">
          {(["chapters", "assignments", "progress"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
                tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {t === "chapters" ? `Chapters (${syllabus.chapters.length})` :
               t === "assignments" ? "Teacher Assignments" : "Progress Overview"}
            </button>
          ))}
        </div>

        {/* ===================== CHAPTERS TAB ===================== */}
        {tab === "chapters" && (
          <div>
            <div className="flex gap-3 mb-4">
              <button onClick={openAddChapter}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium">
                + Add Chapter
              </button>
              <button onClick={() => { setBulkText(""); setBulkPreview([]); setBulkModalOpen(true); }}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-200 text-sm font-medium">
                Bulk Import
              </button>
            </div>

            {syllabus.chapters.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/70 shadow">
                <p className="text-slate-400">No chapters yet.</p>
                <p className="text-slate-400 text-sm mt-1">Add chapters manually or use Bulk Import.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {syllabus.chapters.map((ch) => {
                  const chCompleted = ch.subtopics.filter((st) => st.progress.length > 0).length;
                  const chPercent = ch.subtopics.length > 0 ? Math.round((chCompleted / ch.subtopics.length) * 100) : 0;
                  const chHours = ch.subtopics.reduce((s, st) => s + (st.estimatedHours || 0), 0);
                  const isExpanded = expanded.has(ch.id);

                  return (
                    <div key={ch.id} className="bg-white rounded-2xl border border-slate-200/70 shadow overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
                        onClick={() => toggleExpand(ch.id)}>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 text-sm">{isExpanded ? "v" : ">"}</span>
                          <span className="font-medium text-slate-900">{ch.order}. {ch.name}</span>
                          <span className="text-xs text-slate-400">{ch.subtopics.length} subtopics</span>
                          {chHours > 0 && (
                            <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{chHours}h</span>
                          )}
                          {ch.assignments.length > 0 && (
                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-xs">
                              {[...new Set(ch.assignments.map((a) => a.teacher.user.name))].join(", ")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-200 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${chPercent === 100 ? "bg-green-500" : "bg-blue-500"}`}
                                style={{ width: `${chPercent}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{chPercent}%</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); openEditChapter(ch); }}
                            className="text-slate-400 hover:text-blue-600 text-xs transition-colors">Edit</button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteChapter(ch.id); }}
                            className="text-slate-400 hover:text-red-600 text-xs transition-colors">Delete</button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50">
                          {ch.subtopics.length === 0 ? (
                            <p className="text-slate-400 text-sm py-2">No subtopics yet.</p>
                          ) : (
                            <ul className="space-y-1">
                              {ch.subtopics.map((st) => (
                                <li key={st.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white">
                                  <div className="flex items-center gap-2">
                                    {st.progress.length > 0 ? (
                                      <span className="text-green-500 text-sm">&#10003;</span>
                                    ) : (
                                      <span className="text-slate-300 text-sm">&#9675;</span>
                                    )}
                                    <span className={`text-sm ${st.progress.length > 0 ? "text-slate-500" : "text-slate-700"}`}>
                                      {st.name}
                                    </span>
                                    {st.estimatedHours != null && st.estimatedHours > 0 && (
                                      <span className="text-xs text-orange-500 bg-orange-50 px-1 py-0.5 rounded-full">
                                        {st.estimatedHours}h
                                      </span>
                                    )}
                                    {st.progress.length > 0 && (
                                      <span className="text-xs text-slate-400">
                                        ({st.progress[0].teacher.user.name}
                                        {st.progress[0].batch ? ` / ${st.progress[0].batch.name}` : ""}
                                        , {new Date(st.progress[0].completedAt).toLocaleDateString()})
                                      </span>
                                    )}
                                  </div>
                                  <button onClick={() => handleDeleteSubtopic(ch.id, st.id)}
                                    className="text-slate-300 hover:text-red-500 text-xs transition-colors">Remove</button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <button onClick={() => openAddSubtopic(ch.id)}
                            className="mt-2 text-blue-600 hover:text-blue-700 transition-colors text-xs font-medium">
                            + Add Subtopic
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================== ASSIGNMENTS TAB ===================== */}
        {tab === "assignments" && (
          <div>
            <div className="flex gap-3 mb-4">
              <button onClick={() => { setAssignForm({ teacherId: teachers[0]?.id || "", batchId: batches[0]?.id || "", chapterIds: [] }); setAssignModalOpen(true); }}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium">
                + Assign Chapters to Teacher
              </button>
            </div>

            {batches.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/70 shadow">
                <p className="text-slate-400">No batches of type {BATCH_LABELS[syllabus.batchType] || syllabus.batchType} exist.</p>
                <p className="text-slate-400 text-sm mt-1">Create a batch first before assigning chapters.</p>
              </div>
            ) : teachers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/70 shadow">
                <p className="text-slate-400">No teachers are qualified for {syllabus.subject.name}.</p>
                <p className="text-slate-400 text-sm mt-1">Add subject expertise to teachers first.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Chapter</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Teacher</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subtopics</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syllabus.chapters.map((ch) =>
                      ch.assignments.length > 0 ? (
                        ch.assignments.map((a) => (
                          <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-3 font-medium text-slate-900">{ch.order}. {ch.name}</td>
                            <td className="px-6 py-3 text-slate-600">{a.teacher.user.name}</td>
                            <td className="px-6 py-3">
                              <span className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full text-xs font-medium">{a.batch.name}</span>
                            </td>
                            <td className="px-6 py-3 text-slate-500 text-sm">{ch.subtopics.length}</td>
                            <td className="px-6 py-3 text-right">
                              <button onClick={() => handleUnassign(a.teacherId, ch.id, a.batchId)}
                                className="text-red-500 hover:text-red-600 transition-colors text-xs font-medium">
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr key={ch.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3 font-medium text-slate-900">{ch.order}. {ch.name}</td>
                          <td className="px-6 py-3"><span className="text-slate-400 italic">Unassigned</span></td>
                          <td className="px-6 py-3"><span className="text-slate-400">—</span></td>
                          <td className="px-6 py-3 text-slate-500 text-sm">{ch.subtopics.length}</td>
                          <td className="px-6 py-3"></td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===================== PROGRESS TAB ===================== */}
        {tab === "progress" && (
          <div>
            {report.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/70 shadow">
                <p className="text-slate-400">No progress data yet.</p>
                <p className="text-slate-400 text-sm mt-1">Assign chapters to teachers and they can start marking subtopics as complete.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {report.map((t) => (
                  <div key={`${t.teacherId}_${t.batchId}`} className="bg-white rounded-2xl border border-slate-200/70 shadow p-5">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-slate-900">{t.teacherName}</h3>
                      <span className={`text-lg font-bold ${t.percentComplete === 100 ? "text-green-600" : "text-blue-600"}`}>
                        {t.percentComplete}%
                      </span>
                    </div>
                    <div className="mb-3">
                      <span className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full text-xs font-medium">{t.batchName}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 mb-3">
                      <div className={`h-2 rounded-full ${t.percentComplete === 100 ? "bg-green-500" : "bg-blue-500"}`}
                        style={{ width: `${t.percentComplete}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-slate-500">Chapters: <span className="text-slate-900 font-medium">{t.completedChapters}/{t.assignedChapters}</span></div>
                      <div className="text-slate-500">Subtopics: <span className="text-slate-900 font-medium">{t.completedSubtopics}/{t.totalSubtopics}</span></div>
                    </div>
                    {t.totalEstimatedHours > 0 && (
                      <div className="text-xs text-orange-600 mt-2">
                        {t.completedEstimatedHours.toFixed(1)}/{t.totalEstimatedHours.toFixed(1)}h completed
                      </div>
                    )}
                    {t.lastActivityDate && (
                      <div className="text-xs text-slate-400 mt-1">
                        Last activity: {new Date(t.lastActivityDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================== MODALS ===================== */}

        {/* Add/Edit Chapter */}
        <Modal isOpen={chapterModalOpen} onClose={() => setChapterModalOpen(false)} title={editingChapter ? "Edit Chapter" : "Add Chapter"}>
          <form onSubmit={handleChapterSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Chapter Name *</label>
              <input type="text" value={chapterForm.name} onChange={(e) => setChapterForm({ ...chapterForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                placeholder="e.g., Calculus" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input type="text" value={chapterForm.description} onChange={(e) => setChapterForm({ ...chapterForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                placeholder="Optional" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium">
                {editingChapter ? "Update" : "Add"} Chapter
              </button>
              <button type="button" onClick={() => setChapterModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium">
                Cancel
              </button>
            </div>
          </form>
        </Modal>

        {/* Add Subtopic */}
        <Modal isOpen={subtopicModalOpen} onClose={() => setSubtopicModalOpen(false)} title="Add Subtopic">
          <form onSubmit={handleSubtopicSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subtopic Name *</label>
              <input type="text" value={subtopicForm.name} onChange={(e) => setSubtopicForm({ ...subtopicForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                placeholder="e.g., Limits and Continuity" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Hours</label>
              <input type="number" step="0.5" min="0" value={subtopicForm.estimatedHours}
                onChange={(e) => setSubtopicForm({ ...subtopicForm, estimatedHours: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                placeholder="e.g., 2.5" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium">
                Add Subtopic
              </button>
              <button type="button" onClick={() => setSubtopicModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium">
                Cancel
              </button>
            </div>
          </form>
        </Modal>

        {/* Bulk Import */}
        <Modal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Bulk Import Chapters & Subtopics">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Paste your syllabus structure. Chapters are lines without indentation. Subtopics are indented or start with a dash.
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => { setBulkText(e.target.value); setBulkPreview([]); }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm font-mono transition-all duration-200"
              rows={10}
              placeholder={"Calculus\n  - Limits and Continuity\n  - Derivatives\n  - Integration\nAlgebra\n  - Matrices\n  - Determinants"}
            />

            {bulkPreview.length === 0 ? (
              <button onClick={handleBulkPreview}
                className="w-full bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium text-sm">
                Preview
              </button>
            ) : (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Preview ({bulkPreview.length} chapters):</h4>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50 text-sm space-y-2">
                  {bulkPreview.map((ch, i) => (
                    <div key={i}>
                      <div className="font-medium text-slate-900">{i + 1}. {ch.name}</div>
                      {ch.subtopics.map((st, j) => (
                        <div key={j} className="ml-4 text-slate-600">- {st}</div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 pt-3">
                  <button onClick={handleBulkImport}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-all duration-200 font-medium">
                    Import {bulkPreview.length} Chapters
                  </button>
                  <button onClick={() => setBulkPreview([])}
                    className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium">
                    Edit
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>

        {/* Assign Chapters */}
        <Modal isOpen={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Assign Chapters to Teacher">
          <form onSubmit={handleAssign} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teacher *</label>
              <select value={assignForm.teacherId} onChange={(e) => setAssignForm({ ...assignForm, teacherId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" required>
                <option value="">Select Teacher</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.user.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Batch *</label>
              <select value={assignForm.batchId} onChange={(e) => setAssignForm({ ...assignForm, batchId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" required>
                <option value="">Select Batch</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Chapters *</label>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                {syllabus.chapters.map((ch) => (
                  <label key={ch.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={assignForm.chapterIds.includes(ch.id)}
                      onChange={() => toggleChapterSelect(ch.id)}
                      className="rounded border-slate-300" />
                    <span className="text-sm text-slate-700">{ch.order}. {ch.name}</span>
                    {ch.assignments.length > 0 && (
                      <span className="text-xs text-slate-400">
                        ({[...new Set(ch.assignments.map((a) => `${a.teacher.user.name} (${a.batch.name})`))].join(", ")})
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium">
                Assign {assignForm.chapterIds.length} Chapters
              </button>
              <button type="button" onClick={() => setAssignModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
