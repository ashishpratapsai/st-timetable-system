"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/header";
import { Modal } from "@/components/modal";
import { format } from "date-fns";

interface Leave {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  createdAt: string;
  teacher: { id: string; user: { name: string; email: string } };
}

interface Teacher {
  id: string;
  user: { id: string; name: string };
}

const LEAVE_TYPES = [
  { value: "SICK", label: "Sick Leave" },
  { value: "CASUAL", label: "Casual Leave" },
  { value: "EMERGENCY", label: "Emergency Leave" },
  { value: "PLANNED", label: "Planned Leave" },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

interface SubstituteData {
  affectedEntries: Array<{
    id: string;
    subject: { name: string; code: string };
    batch: { name: string };
    startTime: string;
    endTime: string;
    dayOfWeek: number;
    status: string;
  }>;
  availableTeachers: Array<{ id: string; name: string; subjects: string[]; busySlots: number }>;
  aiSuggestions: Array<{ entryId: string; substituteTeacherId: string; reason: string }> | null;
}

export default function LeavesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [substituteModalOpen, setSubstituteModalOpen] = useState(false);
  const [quickAbsenceOpen, setQuickAbsenceOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<string | null>(null);
  const [substituteData, setSubstituteData] = useState<SubstituteData | null>(null);
  const [assignedEntries, setAssignedEntries] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState<string | null>(null);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [form, setForm] = useState({
    leaveType: "CASUAL", startDate: "", endDate: "", reason: "",
  });
  const [quickForm, setQuickForm] = useState({
    teacherId: "", date: "", reason: "",
  });
  const [quickResult, setQuickResult] = useState<{
    message: string;
    substitutions: Array<{
      subject: string;
      batch: string;
      time: string;
      substituteTeacher: string | null;
      status: string;
    }>;
  } | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);

  async function fetchLeaves() {
    const res = await fetch("/api/leaves");
    setLeaves(await res.json());
    setLoading(false);
  }

  async function fetchTeachers() {
    const res = await fetch("/api/teachers");
    const data = await res.json();
    setTeachers(data.map((t: { id: string; user: { id: string; name: string } }) => ({
      id: t.id,
      user: t.user,
    })));
  }

  useEffect(() => {
    fetchLeaves();
    if (isAdmin) fetchTeachers();
  }, [isAdmin]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setModalOpen(false);
    fetchLeaves();
  }

  async function handleApprove(id: string, status: string) {
    const res = await fetch(`/api/leaves/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    fetchLeaves();

    // If approved and substitute data returned, show the modal
    if (status === "APPROVED" && data.substituteData) {
      setSelectedLeave(id);
      setSubstituteData(data.substituteData);
      setAssignedEntries(new Set());
      setSubstituteModalOpen(true);
    }
  }

  async function viewSubstitutes(leaveId: string) {
    setSelectedLeave(leaveId);
    setSubstituteData(null);
    setAssignedEntries(new Set());
    setSubstituteModalOpen(true);

    const res = await fetch(`/api/leaves/${leaveId}/substitutes`);
    const data = await res.json();
    setSubstituteData(data);
  }

  async function handleAssign(entryId: string, substituteTeacherId: string) {
    if (!selectedLeave) return;
    setAssigning(entryId);

    try {
      const res = await fetch(`/api/leaves/${selectedLeave}/substitutes/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, substituteTeacherId }),
      });

      if (res.ok) {
        setAssignedEntries((prev) => new Set([...prev, entryId]));
      } else {
        const err = await res.json();
        alert(`Failed to assign: ${err.error}`);
      }
    } catch {
      alert("Failed to assign substitute");
    }
    setAssigning(null);
  }

  async function handleAutoAssignAll() {
    if (!selectedLeave || !substituteData?.aiSuggestions) return;
    setAutoAssigning(true);

    for (const suggestion of substituteData.aiSuggestions) {
      if (assignedEntries.has(suggestion.entryId)) continue;
      await handleAssign(suggestion.entryId, suggestion.substituteTeacherId);
    }

    setAutoAssigning(false);
  }

  async function handleQuickAbsence(e: React.FormEvent) {
    e.preventDefault();
    setQuickLoading(true);
    setQuickResult(null);

    try {
      const res = await fetch("/api/leaves/quick-absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quickForm),
      });
      const data = await res.json();

      if (res.ok) {
        setQuickResult({
          message: data.message,
          substitutions: data.substitutions,
        });
        fetchLeaves();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert("Quick absence failed");
    }
    setQuickLoading(false);
  }

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <Header title="Leave Management" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
            <p className="text-gray-500 text-sm mt-1">
              {isAdmin ? "Manage teacher leave requests" : "Apply and track your leaves"}
            </p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <button
                onClick={() => {
                  setQuickForm({ teacherId: "", date: "", reason: "" });
                  setQuickResult(null);
                  setQuickAbsenceOpen(true);
                }}
                className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition text-sm font-medium"
              >
                Quick Absence
              </button>
            )}
            {!isAdmin && (
              <button onClick={() => { setForm({ leaveType: "CASUAL", startDate: "", endDate: "", reason: "" }); setModalOpen(true); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                + Apply for Leave
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : leaves.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">No leave requests yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {isAdmin && <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Teacher</th>}
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Type</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">From</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">To</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Reason</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                    {isAdmin && <td className="px-6 py-4 font-medium text-gray-900">{l.teacher.user.name}</td>}
                    <td className="px-6 py-4 text-gray-600">{LEAVE_TYPES.find((t) => t.value === l.leaveType)?.label}</td>
                    <td className="px-6 py-4 text-gray-600">{format(new Date(l.startDate), "MMM d, yyyy")}</td>
                    <td className="px-6 py-4 text-gray-600">{format(new Date(l.endDate), "MMM d, yyyy")}</td>
                    <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate">{l.reason || "-"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[l.status]}`}>{l.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isAdmin && l.status === "PENDING" && (
                        <>
                          <button onClick={() => handleApprove(l.id, "APPROVED")}
                            className="text-green-600 hover:text-green-800 text-sm font-medium mr-3">Approve</button>
                          <button onClick={() => handleApprove(l.id, "REJECTED")}
                            className="text-red-600 hover:text-red-800 text-sm font-medium mr-3">Reject</button>
                        </>
                      )}
                      {isAdmin && l.status === "APPROVED" && (
                        <button onClick={() => viewSubstitutes(l.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          Manage Substitutes
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Apply for Leave Modal */}
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Apply for Leave">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
              <select value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" rows={3} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">Submit</button>
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition font-medium">Cancel</button>
            </div>
          </form>
        </Modal>

        {/* Substitute Suggestions Modal with Assign Buttons */}
        <Modal isOpen={substituteModalOpen} onClose={() => setSubstituteModalOpen(false)} title="Manage Substitutes">
          {!substituteData ? (
            <div className="text-center py-8 text-gray-500">Loading AI suggestions...</div>
          ) : (
            <div className="space-y-4">
              {/* Auto-Assign All button */}
              {substituteData.aiSuggestions && substituteData.aiSuggestions.length > 0 && (
                <button
                  onClick={handleAutoAssignAll}
                  disabled={autoAssigning}
                  className="w-full bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition font-medium text-sm disabled:opacity-50"
                >
                  {autoAssigning ? "Auto-Assigning..." : "Auto-Assign All AI Suggestions"}
                </button>
              )}

              <h4 className="font-medium text-gray-900">Affected Classes ({substituteData.affectedEntries.length})</h4>
              {substituteData.affectedEntries.map((e) => {
                const isAssigned = assignedEntries.has(e.id);
                const suggestion = substituteData.aiSuggestions?.find((s) => s.entryId === e.id);
                const suggestedTeacher = suggestion
                  ? substituteData.availableTeachers.find((t) => t.id === suggestion.substituteTeacherId)
                  : null;

                return (
                  <div key={e.id} className={`rounded-lg p-3 text-sm border ${isAssigned ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{e.subject.name} - {e.batch.name}</div>
                        <div className="text-gray-500">{DAYS[e.dayOfWeek]} {e.startTime}-{e.endTime}</div>
                      </div>
                      {isAssigned && (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                          Assigned
                        </span>
                      )}
                    </div>

                    {!isAssigned && suggestion && suggestedTeacher && (
                      <div className="mt-2 bg-blue-50 rounded p-2 flex justify-between items-center">
                        <div>
                          <span className="font-medium text-blue-700">AI: {suggestedTeacher.name}</span>
                          <span className="text-blue-600 text-xs ml-2">({suggestion.reason})</span>
                        </div>
                        <button
                          onClick={() => handleAssign(e.id, suggestion.substituteTeacherId)}
                          disabled={assigning === e.id}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          {assigning === e.id ? "..." : "Assign"}
                        </button>
                      </div>
                    )}

                    {!isAssigned && !suggestion && (
                      <div className="mt-2 text-amber-600 text-xs">No AI suggestion available - assign manually below</div>
                    )}

                    {/* Manual assign options for entries without suggestions or when suggestion failed */}
                    {!isAssigned && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {substituteData.availableTeachers
                          .filter((t) => t.subjects.includes(e.subject.name))
                          .map((t) => (
                            <button
                              key={t.id}
                              onClick={() => handleAssign(e.id, t.id)}
                              disabled={assigning === e.id}
                              className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300 disabled:opacity-50"
                            >
                              {t.name} ({t.busySlots} busy)
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Modal>

        {/* Quick Absence Modal */}
        <Modal isOpen={quickAbsenceOpen} onClose={() => setQuickAbsenceOpen(false)} title="Quick Absence">
          {!quickResult ? (
            <form onSubmit={handleQuickAbsence} className="space-y-4">
              <p className="text-sm text-gray-500">
                Auto-creates a leave, finds substitutes with AI, and assigns them automatically.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                <select
                  value={quickForm.teacherId}
                  onChange={(e) => setQuickForm({ ...quickForm, teacherId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  required
                >
                  <option value="">Select Teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.user.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={quickForm.date}
                  onChange={(e) => setQuickForm({ ...quickForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={quickForm.reason}
                  onChange={(e) => setQuickForm({ ...quickForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="e.g., Feeling unwell"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={quickLoading}
                  className="flex-1 bg-amber-500 text-white py-2 rounded-lg hover:bg-amber-600 transition font-medium disabled:opacity-50"
                >
                  {quickLoading ? "Processing with AI..." : "Find & Assign Substitutes"}
                </button>
                <button type="button" onClick={() => setQuickAbsenceOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition font-medium">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg text-sm font-medium ${
                quickResult.substitutions.every((s) => s.status === "assigned")
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}>
                {quickResult.message}
              </div>

              {quickResult.substitutions.map((s, i) => (
                <div key={i} className={`rounded-lg p-3 text-sm border ${
                  s.status === "assigned" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{s.subject} - {s.batch}</div>
                      <div className="text-gray-500">{s.time}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      s.status === "assigned"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {s.status === "assigned" ? `Sub: ${s.substituteTeacher}` : "No substitute"}
                    </span>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setQuickAbsenceOpen(false)}
                className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Close
              </button>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
