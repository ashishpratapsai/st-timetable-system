"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Modal } from "@/components/modal";

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
  order: number;
}

export default function TimeSlotsPage() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ startTime: "", endTime: "", label: "", order: "" });

  async function fetchSlots() {
    const res = await fetch("/api/time-slots");
    setSlots(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchSlots(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/time-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, order: Number(form.order) || slots.length + 1 }),
    });
    setModalOpen(false);
    setForm({ startTime: "", endTime: "", label: "", order: "" });
    fetchSlots();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this time slot?")) return;
    await fetch(`/api/time-slots/${id}`, { method: "DELETE" });
    fetchSlots();
  }

  return (
    <div>
      <Header title="Time Slots" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Time Slots</h1>
            <p className="text-gray-500 text-sm mt-1">Define the daily schedule structure</p>
          </div>
          <button onClick={() => { setForm({ startTime: "", endTime: "", label: "", order: String(slots.length + 1) }); setModalOpen(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            + Add Time Slot
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">#</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Label</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Start</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">End</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-500">{s.order}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{s.label}</td>
                    <td className="px-6 py-4 text-gray-600">{s.startTime}</td>
                    <td className="px-6 py-4 text-gray-600">{s.endTime}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Time Slot">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
              <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required placeholder="Slot 1 (9:00 - 10:00)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
              <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" min={1} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">Add Slot</button>
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition font-medium">Cancel</button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
