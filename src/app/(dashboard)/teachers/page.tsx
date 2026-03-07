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
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
            <p className="text-gray-500 text-sm mt-1">Manage faculty members</p>
          </div>
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            + Add Teacher
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">No teachers yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Subjects</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Availability</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900">{t.user.name}</div>
                        {t.shortCode && (
                          <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{t.shortCode}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">{t.user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.employmentType === "FULL_TIME" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                        {t.employmentType === "FULL_TIME" ? "Full-time" : "Part-time"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {t.subjects.map((s) => (
                          <span key={s.id} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{s.subject.code}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t.availabilitySummary && t.availabilitySummary.totalSlots > 0 ? (
                        <div className="text-xs">
                          <div className="font-medium text-gray-700">{t.availabilitySummary.days.join(", ")}</div>
                          <div className="text-gray-400">{t.availabilitySummary.totalHours}h/week &middot; {t.availabilitySummary.totalSlots} slots</div>
                        </div>
                      ) : (
                        <span className="text-xs text-red-400">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/teachers/${t.id}/syllabus`} className="text-purple-600 hover:text-purple-800 text-xs font-medium mr-2">
                        Syllabus
                      </Link>
                      <Link href={`/teachers/${t.id}/availability`} className="text-green-600 hover:text-green-800 text-xs font-medium mr-2">
                        Schedule
                      </Link>
                      <button onClick={() => openEdit(t)} className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-2">Edit</button>
                      <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Del</button>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Short Code</label>
                <input type="text" value={form.shortCode} onChange={(e) => setForm({ ...form, shortCode: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono" placeholder="ASM" maxLength={5} />
              </div>
            </div>
            {!editing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </div>
            {!editing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password (default: teacher123)</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" placeholder="teacher123" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
              <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subjects</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <button key={s.id} type="button" onClick={() => toggleSubject(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${form.subjectIds.includes(s.id) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">{editing ? "Update" : "Add"} Teacher</button>
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition font-medium">Cancel</button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
