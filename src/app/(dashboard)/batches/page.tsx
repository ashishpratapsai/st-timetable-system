"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Modal } from "@/components/modal";
import { formatBatchType } from "@/lib/utils";

interface BatchSubject {
  id: string;
  hoursPerWeek: number;
  subject: { id: string; name: string; code: string };
}

interface Batch {
  id: string;
  name: string;
  batchType: string;
  strength: number;
  status: string;
  center: { id: string; name: string };
  batchSubjects: BatchSubject[];
}

interface Center { id: string; name: string; }
interface Subject { id: string; name: string; code: string; }

const BATCH_TYPES = [
  { value: "IIT_JEE", label: "IIT-JEE" },
  { value: "NEET", label: "NEET" },
  { value: "JEE_MAINS", label: "JEE Mains" },
  { value: "SCHOOL_8TH", label: "8th Standard" },
  { value: "SCHOOL_9TH", label: "9th Standard" },
  { value: "SCHOOL_10TH", label: "10th Standard" },
];

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [form, setForm] = useState({
    name: "", batchType: "IIT_JEE", centerId: "", strength: "",
    subjects: [] as Array<{ subjectId: string; hoursPerWeek: number }>,
  });

  async function fetchData() {
    const [b, c, s] = await Promise.all([
      fetch("/api/batches").then((r) => r.json()),
      fetch("/api/centers").then((r) => r.json()),
      fetch("/api/subjects").then((r) => r.json()),
    ]);
    setBatches(b);
    setCenters(c);
    setSubjects(s);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", batchType: "IIT_JEE", centerId: centers[0]?.id || "", strength: "", subjects: [] });
    setModalOpen(true);
  }

  function openEdit(b: Batch) {
    setEditing(b);
    setForm({
      name: b.name, batchType: b.batchType, centerId: b.center.id, strength: String(b.strength),
      subjects: b.batchSubjects.map((bs) => ({ subjectId: bs.subject.id, hoursPerWeek: bs.hoursPerWeek })),
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/batches/${editing.id}` : "/api/batches";
    await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, strength: Number(form.strength), status: "ACTIVE" }),
    });
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this batch?")) return;
    await fetch(`/api/batches/${id}`, { method: "DELETE" });
    fetchData();
  }

  function toggleSubject(subjectId: string) {
    setForm((prev) => {
      const exists = prev.subjects.find((s) => s.subjectId === subjectId);
      return {
        ...prev,
        subjects: exists
          ? prev.subjects.filter((s) => s.subjectId !== subjectId)
          : [...prev.subjects, { subjectId, hoursPerWeek: 4 }],
      };
    });
  }

  function updateSubjectHours(subjectId: string, hours: number) {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) => s.subjectId === subjectId ? { ...s, hoursPerWeek: hours } : s),
    }));
  }

  return (
    <div>
      <Header title="Batches" />
      <div className="p-6 animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Batches</h1>
            <p className="text-slate-500 text-sm mt-1">Manage student batches and their subjects</p>
          </div>
          <button onClick={openAdd} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium">
            + Add Batch
          </button>
        </div>

        {loading ? (
          <div className="py-12 space-y-4">
            <div className="h-10 skeleton w-full max-w-2xl mx-auto" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-75" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-50" />
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/70 shadow">
            <p className="text-slate-400">No batches yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200/70 shadow p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{b.name}</h3>
                    <p className="text-sm text-slate-500">{b.center.name}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                    {b.status}
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Type</span>
                    <span className="font-medium">{formatBatchType(b.batchType)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Students</span>
                    <span className="font-medium">{b.strength}</span>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Subjects ({b.batchSubjects.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {b.batchSubjects.map((bs) => (
                      <span key={bs.id} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                        {bs.subject.code} ({bs.hoursPerWeek}h/w)
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button onClick={() => openEdit(b)} className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">Edit</button>
                  <button onClick={() => handleDelete(b.id)} className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors ml-auto">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Batch" : "Add Batch"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Batch Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Type *</label>
                <select value={form.batchType} onChange={(e) => setForm({ ...form, batchType: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200">
                  {BATCH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Strength *</label>
                <input type="number" value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" required min={1} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Center *</label>
              <select value={form.centerId} onChange={(e) => setForm({ ...form, centerId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" required>
                <option value="">Select Center</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Subjects & Weekly Hours</label>
              <div className="space-y-2">
                {subjects.map((s) => {
                  const selected = form.subjects.find((fs) => fs.subjectId === s.id);
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <button type="button" onClick={() => toggleSubject(s.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex-1 text-left ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                        {s.name} ({s.code})
                      </button>
                      {selected && (
                        <input type="number" value={selected.hoursPerWeek} onChange={(e) => updateSubjectHours(s.id, Number(e.target.value))}
                          className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-sm" min={1} max={20} placeholder="hrs/wk" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium">{editing ? "Update" : "Add"} Batch</button>
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium">Cancel</button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
