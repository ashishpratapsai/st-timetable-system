"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Modal } from "@/components/modal";

interface TeachingAssignment {
  id: string;
  teacherId: string;
  batchId: string;
  subjectId: string;
  totalHours: number;
  completedHours: number;
  startDate: string;
  endDate: string;
  notes: string | null;
  teacher: { id: string; user: { name: string } };
  batch: { id: string; name: string; center: { name: string } };
  subject: { id: string; name: string; code: string };
  totalWeeks: number;
  remainingHours: number;
  hoursPerWeek: number;
  slotsPerWeek: number;
}

interface Teacher {
  id: string;
  user: { name: string };
  subjects: Array<{ subject: { id: string; name: string; code: string } }>;
}

interface Batch {
  id: string;
  name: string;
  batchType: string;
  center: { name: string };
  batchSubjects: Array<{ subject: { id: string; name: string; code: string } }>;
}

export default function TeachingAssignmentsPage() {
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeachingAssignment | null>(null);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [form, setForm] = useState({
    teacherId: "",
    batchId: "",
    subjectId: "",
    totalHours: "",
    completedHours: "0",
    startDate: "2026-03-01",
    endDate: "2026-08-31",
    notes: "",
  });

  async function fetchData() {
    const [a, t, b] = await Promise.all([
      fetch("/api/teaching-assignments").then((r) => r.json()),
      fetch("/api/teachers").then((r) => r.json()),
      fetch("/api/batches").then((r) => r.json()),
    ]);
    setAssignments(a);
    setTeachers(t);
    setBatches(b);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({
      teacherId: "",
      batchId: "",
      subjectId: "",
      totalHours: "",
      completedHours: "0",
      startDate: "2026-03-01",
      endDate: "2026-08-31",
      notes: "",
    });
    setModalOpen(true);
  }

  function openEdit(a: TeachingAssignment) {
    setEditing(a);
    setForm({
      teacherId: a.teacherId,
      batchId: a.batchId,
      subjectId: a.subjectId,
      totalHours: String(a.totalHours),
      completedHours: String(a.completedHours),
      startDate: a.startDate.slice(0, 10),
      endDate: a.endDate.slice(0, 10),
      notes: a.notes || "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      await fetch(`/api/teaching-assignments/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalHours: form.totalHours,
          completedHours: form.completedHours,
          startDate: form.startDate,
          endDate: form.endDate,
          notes: form.notes,
        }),
      });
    } else {
      await fetch("/api/teaching-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this teaching assignment?")) return;
    await fetch(`/api/teaching-assignments/${id}`, { method: "DELETE" });
    fetchData();
  }

  // Get available subjects based on selected teacher
  const selectedTeacher = teachers.find((t) => t.id === form.teacherId);
  const teacherSubjects = selectedTeacher?.subjects.map((s) => s.subject) || [];

  // Filter assignments by teacher
  const filtered = filterTeacher
    ? assignments.filter((a) => a.teacherId === filterTeacher)
    : assignments;

  // Group by teacher for summary
  const teacherSummary = assignments.reduce((acc, a) => {
    if (!acc[a.teacherId]) {
      acc[a.teacherId] = { name: a.teacher.user.name, totalSlots: 0, totalHours: 0, batches: 0 };
    }
    acc[a.teacherId].totalSlots += a.slotsPerWeek;
    acc[a.teacherId].totalHours += a.hoursPerWeek;
    acc[a.teacherId].batches += 1;
    return acc;
  }, {} as Record<string, { name: string; totalSlots: number; totalHours: number; batches: number }>);

  return (
    <div>
      <Header title="Teaching Assignments" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Teaching Assignments</h1>
            <p className="text-gray-500 text-sm mt-1">Assign teachers to batches with syllabus hours</p>
          </div>
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            + Add Assignment
          </button>
        </div>

        {/* Teacher Weekly Summary Cards */}
        {Object.keys(teacherSummary).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {Object.entries(teacherSummary).map(([tid, s]) => (
              <button
                key={tid}
                onClick={() => setFilterTeacher(filterTeacher === tid ? "" : tid)}
                className={`text-left p-3 rounded-lg border transition ${
                  filterTeacher === tid ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-gray-900 text-sm truncate">{s.name}</div>
                <div className="text-xs text-gray-500 mt-1">{s.batches} batches</div>
                <div className="text-xs mt-1">
                  <span className="text-blue-600 font-medium">{s.totalSlots} slots/wk</span>
                  <span className="text-gray-400 ml-1">({s.totalHours.toFixed(1)}h)</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {filterTeacher && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-gray-500">Filtered by:</span>
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-medium">
              {teacherSummary[filterTeacher]?.name}
            </span>
            <button onClick={() => setFilterTeacher("")} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">No teaching assignments yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Teacher</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Batch</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Subject</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Hours</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Progress</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Duration</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Weekly Plan</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const progress = a.totalHours > 0 ? (a.completedHours / a.totalHours) * 100 : 0;
                  return (
                    <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-sm">{a.teacher.user.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{a.batch.name}</div>
                        <div className="text-xs text-gray-400">{a.batch.center.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{a.subject.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{a.totalHours}h total</div>
                        <div className="text-xs text-gray-400">{a.remainingHours}h remaining</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-24">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">{a.completedHours}h</span>
                            <span className="text-gray-400">{progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-600">
                          {new Date(a.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} - {new Date(a.endDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                        </div>
                        <div className="text-xs text-gray-400">{a.totalWeeks} weeks</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-purple-700">{a.slotsPerWeek} slots/wk</div>
                        <div className="text-xs text-gray-400">{a.hoursPerWeek}h/wk needed</div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(a)} className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-2">Edit</button>
                        <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Del</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Assignment" : "Add Teaching Assignment"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editing && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teacher *</label>
                  <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value, subjectId: "" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required>
                    <option value="">Select Teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch *</label>
                  <select value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required>
                    <option value="">Select Batch</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                  <select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required>
                    <option value="">Select Subject</option>
                    {teacherSubjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                  {form.teacherId && teacherSubjects.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">This teacher has no subjects assigned.</p>
                  )}
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Hours *</label>
                <input type="number" value={form.totalHours} onChange={(e) => setForm({ ...form, totalHours: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required min="1" placeholder="300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Completed Hours</label>
                <input type="number" value={form.completedHours} onChange={(e) => setForm({ ...form, completedHours: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" min="0" placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" placeholder="e.g., IIT-JEE Advanced Maths - high priority" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">{editing ? "Update" : "Add"} Assignment</button>
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition font-medium">Cancel</button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
