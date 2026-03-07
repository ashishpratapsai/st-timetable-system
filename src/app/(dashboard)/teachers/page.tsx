"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Modal } from "@/components/modal";
import Link from "next/link";

interface Teacher {
  id: string;
  shortCode: string | null;
  employmentType: string;
  user: { id: string; name: string; email: string; phone: string | null };
  subjects: Array<{ id: string; subject: { id: string; name: string; code: string } }>;
  _count: { timetableEntries: number; leaves: number };
  availabilitySummary?: { days: string[]; totalSlots: number; totalHours: number };
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "",
    shortCode: "", employmentType: "FULL_TIME", subjectIds: [] as string[],
  });

  async function fetchData() {
    const [t, s] = await Promise.all([
      fetch("/api/teachers").then((r) => r.json()),
      fetch("/api/subjects").then((r) => r.json()),
    ]);
    setTeachers(t);
    setSubjects(s);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", password: "", shortCode: "", employmentType: "FULL_TIME", subjectIds: [] });
    setModalOpen(true);
  }

  function openEdit(t: Teacher) {
    setEditing(t);
    setForm({
      name: t.user.name,
      email: t.user.email,
      phone: t.user.phone || "",
      password: "",
      shortCode: t.shortCode || "",
      employmentType: t.employmentType,
      subjectIds: t.subjects.map((s) => s.subject.id),
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      await fetch(`/api/teachers/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this teacher? This will also remove their user account.")) return;
    await fetch(`/api/teachers/${id}`, { method: "DELETE" });
    fetchData();
  }

  function toggleSubject(subjectId: string) {
    setForm((prev) => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(subjectId)
        ? prev.subjectIds.filter((id) => id !== subjectId)
        : [...prev.subjectIds, subjectId],
    }));
  }

  return (
    <div>
      <Header title="Teachers" />
      <div className="p-6 animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Teachers</h1>
            <p className="text-slate-500 text-sm mt-1">Manage faculty members</p>
          </div>
          <button onClick={openAdd} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium">
            + Add Teacher
          </button>
        </div>

        {loading ? (
          <div className="py-12 space-y-4">
            <div className="h-10 skeleton w-full max-w-2xl mx-auto" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-75" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-50" />
          </div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-400">No teachers yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subjects</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Availability</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-slate-900">{t.user.name}</div>
                        {t.shortCode && (
                          <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{t.shortCode}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">{t.user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.employmentType === "FULL_TIME" ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                        {t.employmentType === "FULL_TIME" ? "Full-time" : "Part-time"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {t.subjects.map((s) => (
                          <span key={s.id} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">{s.subject.code}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t.availabilitySummary && t.availabilitySummary.totalSlots > 0 ? (
                        <div className="text-xs">
                          <div className="font-medium text-slate-700">{t.availabilitySummary.days.join(", ")}</div>
                          <div className="text-gray-400">{t.availabilitySummary.totalHours}h/week &middot; {t.availabilitySummary.totalSlots} slots</div>
                        </div>
                      ) : (
                        <span className="text-xs text-red-400">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/teachers/${t.id}/syllabus`} className="text-purple-600 hover:text-purple-700 text-xs font-medium transition-colors mr-2">
                        Syllabus
                      </Link>
                      <Link href={`/teachers/${t.id}/availability`} className="text-green-600 hover:text-green-700 text-xs font-medium transition-colors mr-2">
                        Schedule
                      </Link>
                      <button onClick={() => openEdit(t)} className="text-blue-600 hover:text-blue-700 text-xs font-medium transition-colors mr-2">Edit</button>
                      <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-600 text-xs font-medium transition-colors">Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Teacher" : "Add Teacher"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Short Code</label>
                <input type="text" value={form.shortCode} onChange={(e) => setForm({ ...form, shortCode: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 font-mono" placeholder="ASM" maxLength={5} />
              </div>
            </div>
            {!editing && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" required />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" />
            </div>
            {!editing && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password (default: teacher123)</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" placeholder="teacher123" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Employment Type</label>
              <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200">
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Subjects</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <button key={s.id} type="button" onClick={() => toggleSubject(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${form.subjectIds.includes(s.id) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium">{editing ? "Update" : "Add"} Teacher</button>
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium">Cancel</button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
