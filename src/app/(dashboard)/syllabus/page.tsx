"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Modal } from "@/components/modal";

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface SyllabusItem {
  id: string;
  name: string;
  description: string | null;
  batchType: string;
  subject: Subject;
  totalChapters: number;
  totalSubtopics: number;
  completedSubtopics: number;
  progressPercent: number;
  assignedTeachers: string[];
  totalEstimatedHours: number | null;
}

const BATCH_TYPES = [
  { value: "IIT_JEE", label: "IIT-JEE" },
  { value: "NEET", label: "NEET" },
  { value: "JEE_MAINS", label: "JEE Mains" },
  { value: "SCHOOL_8TH", label: "8th Standard" },
  { value: "SCHOOL_9TH", label: "9th Standard" },
  { value: "SCHOOL_10TH", label: "10th Standard" },
];

export default function SyllabusPage() {
  const router = useRouter();
  const [syllabi, setSyllabi] = useState<SyllabusItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SyllabusItem | null>(null);
  const [filterBatchType, setFilterBatchType] = useState("");
  const [form, setForm] = useState({ batchType: "IIT_JEE", subjectId: "", name: "", description: "" });

  async function fetchData() {
    const params = filterBatchType ? `?batchType=${filterBatchType}` : "";
    const [s, sub] = await Promise.all([
      fetch(`/api/syllabus${params}`).then((r) => r.json()),
      fetch("/api/subjects").then((r) => r.json()),
    ]);
    setSyllabi(s);
    setSubjects(sub);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [filterBatchType]);

  function openAdd() {
    setEditing(null);
    setForm({ batchType: "IIT_JEE", subjectId: subjects[0]?.id || "", name: "", description: "" });
    setModalOpen(true);
  }

  function openEdit(s: SyllabusItem) {
    setEditing(s);
    setForm({ batchType: s.batchType, subjectId: s.subject.id, name: s.name, description: s.description || "" });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      await fetch(`/api/syllabus/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, description: form.description }),
      });
    } else {
      const res = await fetch("/api/syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create syllabus");
        return;
      }
    }
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this syllabus and all its chapters/subtopics?")) return;
    await fetch(`/api/syllabus/${id}`, { method: "DELETE" });
    fetchData();
  }

  function getBatchLabel(type: string) {
    return BATCH_TYPES.find((b) => b.value === type)?.label || type;
  }

  return (
    <div>
      <Header title="Syllabus" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Syllabus Management</h1>
            <p className="text-gray-500 text-sm mt-1">Define syllabi, chapters, and track teacher progress</p>
          </div>
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            + Add Syllabus
          </button>
        </div>

        {/* Filter */}
        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Batch Type</label>
            <select value={filterBatchType} onChange={(e) => setFilterBatchType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">All Types</option>
              {BATCH_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : syllabi.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">No syllabi yet.</p>
            <p className="text-gray-400 text-sm mt-1">Create a syllabus to start defining chapters and tracking progress.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Syllabus</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Batch Type</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Subject</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Chapters</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Est. Hours</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Progress</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Teachers</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {syllabi.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer" onClick={() => router.push(`/syllabus/${s.id}`)}>
                        {s.name}
                      </div>
                      {s.description && <div className="text-xs text-gray-400 mt-0.5">{s.description}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">
                        {getBatchLabel(s.batchType)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
                        {s.subject.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {s.totalChapters} chapters, {s.totalSubtopics} subtopics
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {s.totalEstimatedHours != null && s.totalEstimatedHours > 0 ? (
                        <span className="text-orange-600 font-medium">{s.totalEstimatedHours}h</span>
                      ) : (
                        <span className="text-gray-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${s.progressPercent === 100 ? "bg-green-500" : "bg-blue-500"}`}
                            style={{ width: `${s.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{s.progressPercent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {s.assignedTeachers.length > 0 ? s.assignedTeachers.join(", ") : "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => router.push(`/syllabus/${s.id}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">Manage</button>
                      <button onClick={() => openEdit(s)}
                        className="text-gray-600 hover:text-gray-800 text-sm font-medium mr-3">Edit</button>
                      <button onClick={() => handleDelete(s.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Syllabus" : "Add Syllabus"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editing && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Type *</label>
                  <select value={form.batchType} onChange={(e) => setForm({ ...form, batchType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required>
                    {BATCH_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                  <select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required>
                    <option value="">Select Subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="e.g., IIT JEE Advance - Mathematics" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Optional description" rows={2} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">
                {editing ? "Update" : "Create"} Syllabus
              </button>
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition font-medium">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
