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
      <div className="p-3 sm:p-4 md:p-6 animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Time Slots</h1>
            <p className="text-slate-500 text-sm mt-1">Define the daily schedule structure</p>
          </div>
          <button onClick={() => { setForm({ startTime: "", endTime: "", label: "", order: String(slots.length + 1) }); setModalOpen(true); }}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium">
            + Add Time Slot
          </button>
        </div>

        {loading ? (
          <div className="py-12 space-y-4">
            <div className="h-10 skeleton w-full max-w-2xl mx-auto" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-75" />
            <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-50" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Label</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Start</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">End</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500">{s.order}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{s.label}</td>
                    <td className="px-6 py-4 text-slate-600">{s.startTime}</td>
                    <td className="px-6 py-4 text-slate-600">{s.endTime}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors">Delete</button>
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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Label *</label>
              <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" required placeholder="Slot 1 (9:00 - 10:00)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Time *</label>
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">End Time *</label>
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Order</label>
              <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" min={1} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium">Add Slot</button>
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium">Cancel</button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
