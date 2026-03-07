"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Modal } from "@/components/modal";

interface Subject {
  id: string;
  name: string;
  code: string;
  _count: { teacherSubjects: number; batchSubjects: number };
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({ name: "", code: "" });

  async function fetchSubjects() {
    const res = await fetch("/api/subjects");
    setSubjects(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchSubjects(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", code: "" });
    setModalOpen(true);
  }

  function openEdit(s: Subject) {
    setEditing(s);
    setForm({ name: s.name, code: s.code });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/subjects/${editing.id}` : "/api/subjects";
    await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setModalOpen(false);
    fetchSubjects();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this subject?")) return;
    await fetch(`/api/subjects/${id}`, { method: "DELETE" });
    fetchSubjects();
  }

  return (
    <div>
      <Header title="Subjects" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
            <p className="text-gray-500 text-sm mt-1">Manage subjects taught at your centers</p>
          </div>
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            + Add Subject
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">No subjects yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Code</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Teachers</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Batches</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{s.name}</td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{s.code}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{s._count.teacherSubjects}</td>
                    <td className="px-6 py-4 text-gray-600">{s._count.batchSubjects}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">Edit</button>
                      <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Subject" : "Add Subject"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code * (e.g., PHY, CHE)</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required maxLength={5} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">{editing ? "Update" : "Add"} Subject</button>
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition font-medium">Cancel</button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
