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
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Centers</h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage your coaching center locations
            </p>
          </div>
          <button
            onClick={openAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            + Add Center
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : centers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">No centers yet. Add your first center.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Address</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Phone</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Classrooms</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Batches</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {centers.map((center) => (
                  <tr key={center.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{center.name}</td>
                    <td className="px-6 py-4 text-gray-600">{center.address || "-"}</td>
                    <td className="px-6 py-4 text-gray-600">{center.phone || "-"}</td>
                    <td className="px-6 py-4 text-gray-600">{center._count.classrooms}</td>
                    <td className="px-6 py-4 text-gray-600">{center._count.batches}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEdit(center)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(center.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                {editing ? "Update" : "Add"} Center
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition font-medium"
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
