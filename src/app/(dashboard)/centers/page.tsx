"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Modal } from "@/components/modal";

interface Center {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  _count: { classrooms: number; batches: number };
}

export default function CentersPage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Center | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });

  async function fetchCenters() {
    const res = await fetch("/api/centers");
    const data = await res.json();
    setCenters(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchCenters();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", address: "", phone: "" });
    setModalOpen(true);
  }

  function openEdit(center: Center) {
    setEditing(center);
    setForm({
      name: center.name,
      address: center.address || "",
      phone: center.phone || "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/centers/${editing.id}` : "/api/centers";
    const method = editing ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setModalOpen(false);
    fetchCenters();
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this center?")) return;
    await fetch(`/api/centers/${id}`, { method: "DELETE" });
    fetchCenters();
  }

  return (
    <div>
      <Header title="Centers" />
      <div className="p-6 animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Centers</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage your coaching center locations
            </p>
          </div>
          <button
            onClick={openAdd}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium"
          >
            + Add Center
          </button>
        </div>

        {loading ? (
          <div className="py-12 space-y-4">
            <div className="h-10 skeleton w-full max-w-2xl mx-auto" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-75" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-50" />
          </div>
        ) : centers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/70 shadow">
            <p className="text-slate-400">No centers yet. Add your first center.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Address</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Classrooms</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Batches</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {centers.map((center) => (
                  <tr key={center.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{center.name}</td>
                    <td className="px-6 py-4 text-slate-600">{center.address || "-"}</td>
                    <td className="px-6 py-4 text-slate-600">{center.phone || "-"}</td>
                    <td className="px-6 py-4 text-slate-600">{center._count.classrooms}</td>
                    <td className="px-6 py-4 text-slate-600">{center._count.batches}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEdit(center)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(center.id)}
                        className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editing ? "Edit Center" : "Add Center"}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Address
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium"
              >
                {editing ? "Update" : "Add"} Center
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
