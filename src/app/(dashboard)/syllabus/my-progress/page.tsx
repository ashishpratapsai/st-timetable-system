"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";

interface SubtopicItem {
  id: string;
  name: string;
  order: number;
  estimatedHours: number | null;
  completed: boolean;
  completedAt: string | null;
}

interface ChapterItem {
  id: string;
  name: string;
  order: number;
  subtopics: SubtopicItem[];
  totalSubtopics: number;
  completedSubtopics: number;
  totalEstimatedHours: number;
  completedEstimatedHours: number;
}

interface SyllabusProgress {
  syllabusId: string;
  syllabusName: string;
  batchType: string;
  batchId: string;
  batchName: string;
  subject: { id: string; name: string; code: string };
  chapters: ChapterItem[];
}

const BATCH_LABELS: Record<string, string> = {
  IIT_JEE: "IIT-JEE", NEET: "NEET", JEE_MAINS: "JEE Mains",
  SCHOOL_8TH: "8th Standard", SCHOOL_9TH: "9th Standard", SCHOOL_10TH: "10th Standard",
};

export default function MyProgressPage() {
  const [data, setData] = useState<SyllabusProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  async function fetchData() {
    const res = await fetch("/api/syllabus/progress");
    const json = await res.json();
    setData(Array.isArray(json) ? json : []);
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

  async function toggleSubtopic(subtopicId: string, completed: boolean, batchId: string, syllabusId: string) {
    const key = `${subtopicId}_${batchId}`;
    setToggling((prev) => new Set(prev).add(key));

    if (!completed) {
      // Mark complete
      await fetch("/api/syllabus/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtopicId, batchId }),
      });
    } else {
      // Need to find the progress record ID to delete
      // Fetch the full syllabus detail which includes progress records with IDs
      let progressId: string | null = null;
      const detailRes = await fetch(`/api/syllabus/${syllabusId}`);
      const detail = await detailRes.json();
      for (const dch of detail.chapters) {
        for (const dst of dch.subtopics) {
          if (dst.id === subtopicId) {
            const match = dst.progress.find((p: { batch?: { id: string } }) => p.batch?.id === batchId);
            if (match) {
              progressId = match.id;
              break;
            }
          }
        }
        if (progressId) break;
      }

      if (progressId) {
        await fetch(`/api/syllabus/progress/${progressId}`, { method: "DELETE" });
      }
    }

    setToggling((prev) => { const next = new Set(prev); next.delete(key); return next; });
    fetchData();
  }

  // Summary stats
  const totalAssigned = data.reduce((sum, s) => sum + s.chapters.length, 0);
  const totalSubtopics = data.reduce((sum, s) => sum + s.chapters.reduce((cs, ch) => cs + ch.totalSubtopics, 0), 0);
  const completedSubtopics = data.reduce((sum, s) => sum + s.chapters.reduce((cs, ch) => cs + ch.completedSubtopics, 0), 0);
  const overallPercent = totalSubtopics > 0 ? Math.round((completedSubtopics / totalSubtopics) * 100) : 0;
  const completedChapters = data.reduce(
    (sum, s) => sum + s.chapters.filter((ch) => ch.totalSubtopics > 0 && ch.completedSubtopics === ch.totalSubtopics).length, 0
  );

  return (
    <div>
      <Header title="My Syllabus" />
      <div className="p-6 animate-fadeIn">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Syllabus Progress</h1>
          <p className="text-slate-500 text-sm mt-1">Track your assigned chapters and mark subtopics as completed</p>
        </div>

        {/* Summary */}
        {!loading && data.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-4">
              <div className="text-2xl font-bold text-slate-900">{totalAssigned}</div>
              <div className="text-xs text-slate-500">Assigned Chapters</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-4">
              <div className="text-2xl font-bold text-green-600">{completedChapters}</div>
              <div className="text-xs text-slate-500">Completed Chapters</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-4">
              <div className="text-2xl font-bold text-blue-600">{completedSubtopics}/{totalSubtopics}</div>
              <div className="text-xs text-slate-500">Subtopics Done</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-4">
              <div className="flex items-end gap-2">
                <div className="text-2xl font-bold text-slate-900">{overallPercent}%</div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                <div className={`h-2 rounded-full ${overallPercent === 100 ? "bg-green-500" : "bg-blue-500"}`}
                  style={{ width: `${overallPercent}%` }} />
              </div>
              <div className="text-xs text-slate-500 mt-1">Overall Progress</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 space-y-4">
            <div className="h-10 skeleton w-full max-w-2xl mx-auto" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-75" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-50" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/70 shadow">
            <p className="text-slate-400 text-lg mb-2">No syllabi assigned to you</p>
            <p className="text-slate-400 text-sm">Your admin will assign chapters from the syllabus management page.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {data.map((syl) => {
              const sylTotal = syl.chapters.reduce((s, ch) => s + ch.totalSubtopics, 0);
              const sylCompleted = syl.chapters.reduce((s, ch) => s + ch.completedSubtopics, 0);
              const sylPercent = sylTotal > 0 ? Math.round((sylCompleted / sylTotal) * 100) : 0;

              return (
                <div key={`${syl.syllabusId}_${syl.batchId}`} className="bg-white rounded-2xl border border-slate-200/70 shadow overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h2 className="font-semibold text-slate-900">{syl.syllabusName}</h2>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {BATCH_LABELS[syl.batchType] || syl.batchType}
                        </span>
                        <span className="bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {syl.subject.code}
                        </span>
                        <span className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {syl.batchName}
                        </span>
                        <span className="text-slate-500 text-xs">{syl.chapters.length} chapters assigned</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${sylPercent === 100 ? "bg-green-500" : "bg-blue-500"}`}
                          style={{ width: `${sylPercent}%` }} />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{sylPercent}%</span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {syl.chapters.map((ch) => {
                      const chPercent = ch.totalSubtopics > 0 ? Math.round((ch.completedSubtopics / ch.totalSubtopics) * 100) : 0;
                      const isComplete = ch.totalSubtopics > 0 && ch.completedSubtopics === ch.totalSubtopics;
                      const isExpanded = expanded.has(`${ch.id}_${syl.batchId}`);

                      return (
                        <div key={ch.id}>
                          <div className={`flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50/50 transition-colors ${isComplete ? "bg-green-50" : ""}`}
                            onClick={() => toggleExpand(`${ch.id}_${syl.batchId}`)}>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400 text-sm">{isExpanded ? "v" : ">"}</span>
                              {isComplete ? (
                                <span className="text-green-500 font-bold">&#10003;</span>
                              ) : (
                                <span className="text-slate-300">&#9675;</span>
                              )}
                              <span className={`font-medium ${isComplete ? "text-green-700" : "text-slate-900"}`}>
                                {ch.order}. {ch.name}
                              </span>
                              {ch.totalEstimatedHours > 0 && (
                                <span className="text-xs text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">{ch.totalEstimatedHours}h</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-500">{ch.completedSubtopics}/{ch.totalSubtopics}</span>
                              <div className="w-16 bg-slate-200 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${isComplete ? "bg-green-500" : "bg-blue-500"}`}
                                  style={{ width: `${chPercent}%` }} />
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-5 py-2 bg-slate-50 border-t border-slate-100">
                              <ul className="space-y-1">
                                {ch.subtopics.map((st) => (
                                  <li key={st.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white">
                                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                                      <input
                                        type="checkbox"
                                        checked={st.completed}
                                        disabled={toggling.has(`${st.id}_${syl.batchId}`)}
                                        onChange={() => toggleSubtopic(st.id, st.completed, syl.batchId, syl.syllabusId)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className={`text-sm ${st.completed ? "text-slate-500 line-through" : "text-slate-700"}`}>
                                        {st.name}
                                      </span>
                                      {st.estimatedHours != null && st.estimatedHours > 0 && (
                                        <span className="text-xs text-orange-500 bg-orange-50 px-1 py-0.5 rounded-full">{st.estimatedHours}h</span>
                                      )}
                                    </label>
                                    {st.completed && st.completedAt && (
                                      <span className="text-xs text-green-600">
                                        {new Date(st.completedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
