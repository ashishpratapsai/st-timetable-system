"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Modal } from "@/components/modal";
import { format } from "date-fns";

interface Classroom {
  id: string;
  name: string;
  capacity: number;
  centerId: string;
  center: { id: string; name: string };
  equipment: string[];
  _count: { timetableEntries: number };
}

interface Center {
  id: string;
  name: string;
}

interface ClassroomBlock {
  id: string;
  classroomId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  classroom: { name: string; center: { name: string } };
}

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [blocks, setBlocks] = useState<ClassroomBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [form, setForm] = useState({ name: "", capacity: "", centerId: "", equipment: "" });
  const [blockForm, setBlockForm] = useState({ classroomId: "", date: "", startTime: "", endTime: "", reason: "" });
  const [timeSlots, setTimeSlots] = useState<Array<{ startTime: string; endTime: string; label: string }>>([]);
  const [tab, setTab] = useState<"classrooms" | "availability">("classrooms");

  async function fetchData() {
    const [c, ct, ts] = await Promise.all([
      fetch("/api/classrooms").then((r) => r.json()),
      fetch("/api/centers").then((r) => r.json()),
      fetch("/api/time-slots").then((r) => r.json()),
    ]);
    setClassrooms(c);
    setCenters(ct);
    setTimeSlots(ts);
    setLoading(false);
  }

  async function fetchBlocks() {
    const res = await fetch("/api/classroom-availability");
    setBlocks(await res.json());
  }

  useEffect(() => { fetchData(); fetchBlocks(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", capacity: "", centerId: centers[0]?.id || "", equipment: "" });
    setModalOpen(true);
  }

  function openEdit(c: Classroom) {
    setEditing(c);
    setForm({ name: c.name, capacity: String(c.capacity), centerId: c.centerId, equipment: c.equipment.join(", ") });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      ...form,
      capacity: Number(form.capacity),
      equipment: form.equipment.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const url = editing ? `/api/classrooms/${editing.id}` : "/api/classrooms";
    await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this classroom?")) return;
    await fetch(`/api/classrooms/${id}`, { method: "DELETE" });
    fetchData();
  }

  async function handleBlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/classroom-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blockForm),
    });
    setBlockModalOpen(false);
    fetchBlocks();
  }

  async function handleRemoveBlock(id: string) {
    await fetch(`/api/classroom-availability?id=${id}`, { method: "DELETE" });
    fetchBlocks();
  }

  return (
    <div>
      <Header title="Classrooms" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Classrooms</h1>
            <p className="text-gray-500 text-sm mt-1">Manage rooms and availability</p>
          </div>
          <div className="flex gap-3">
            {tab === "availability" && (
              <button
                onClick={() => {
                  setBlockForm({ classroomId: classrooms[0]?.id || "", date: "", startTime: "", endTime: "", reason: "" });
                  setBlockModalOpen(true);
                }}
                className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition text-sm font-medium"
              >
                + Block Classroom
              </button>
            )}
            {tab === "classrooms" && (
              <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                + Add Classroom
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setTab("classrooms")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "classrooms" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Classrooms ({classrooms.length})
          </button>
          <button
            onClick={() => setTab("availability")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "availability" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Availability Blocks ({blocks.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : tab === "classrooms" ? (
          /* Classrooms Table */
          classrooms.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500">No classrooms yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Center</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Capacity</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Equipment</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classrooms.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                      <td className="px-6 py-4 text-gray-600">{c.center.name}</td>
                      <td className="px-6 py-4 text-gray-600">{c.capacity} seats</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {c.equipment.map((eq) => (
                            <span key={eq} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{eq}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">Edit</button>
                        <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Availability Blocks Table */
          blocks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500">No classroom blocks. All classrooms are available.</p>
              <p className="text-gray-400 text-sm mt-1">Block a classroom to mark it unavailable for a specific date and time.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Classroom</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Center</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Date</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Time</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Reason</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((b) => (
                    <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{b.classroom.name}</td>
                      <td className="px-6 py-4 text-gray-600">{b.classroom.center.name}</td>
                      <td className="px-6 py-4 text-gray-600">{format(new Date(b.date), "MMM d, yyyy")}</td>
                      <td className="px-6 py-4 text-gray-600">{b.startTime} - {b.endTime}</td>
                      <td className="px-6 py-4 text-gray-600">{b.reason || "-"}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleRemoveBlock(b.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Add/Edit Classroom Modal */}
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Classroom" : "Add Classroom"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Center *</label>
              <select value={form.centerId} onChange={(e) => setForm({ ...form, centerId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required>
                <option value="">Select Center</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity *</label>
              <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required min={1} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Equipment (comma-separated)</label>
              <input type="text" value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" placeholder="projector, whiteboard, ac" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">{editing ? "Update" : "Add"} Classroom</button>
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition font-medium">Cancel</button>
            </div>
          </form>
        </Modal>

        {/* Block Classroom Modal */}
        <Modal isOpen={blockModalOpen} onClose={() => setBlockModalOpen(false)} title="Block Classroom">
          <form onSubmit={handleBlockSubmit} className="space-y-4">
            <p className="text-sm text-gray-500">
              Mark a classroom as unavailable for a specific date and time slot. The timetable generator will skip this classroom during blocked times.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classroom *</label>
              <select value={blockForm.classroomId} onChange={(e) => setBlockForm({ ...blockForm, classroomId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" required>
                <option value="">Select Classroom</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.center.name})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={blockForm.date} onChange={(e) => setBlockForm({ ...blockForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Slot *</label>
              <select
                value={blockForm.startTime ? `${blockForm.startTime}-${blockForm.endTime}` : ""}
                onChange={(e) => {
                  const [start, end] = e.target.value.split("-");
                  setBlockForm({ ...blockForm, startTime: start, endTime: end });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" required
              >
                <option value="">Select Time Slot</option>
                {timeSlots.map((s) => (
                  <option key={`${s.startTime}-${s.endTime}`} value={`${s.startTime}-${s.endTime}`}>
                    {s.label || `${s.startTime} - ${s.endTime}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input type="text" value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="e.g., Parent meeting, Maintenance" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-amber-500 text-white py-2 rounded-lg hover:bg-amber-600 transition font-medium">Block Classroom</button>
              <button type="button" onClick={() => setBlockModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition font-medium">Cancel</button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
