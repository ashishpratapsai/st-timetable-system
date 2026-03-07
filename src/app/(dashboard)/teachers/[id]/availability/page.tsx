"use client";

import { useState, useEffect, use } from "react";
import { Header } from "@/components/header";
import { DAYS_OF_WEEK } from "@/lib/utils";

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
  order: number;
}

interface AvailabilityEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface Teacher {
  id: string;
  employmentType: string;
  user: { name: string };
}

export default function AvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: teacherId } = use(params);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [slotsRes, availRes, teachersRes] = await Promise.all([
        fetch("/api/time-slots").then((r) => r.json()),
        fetch(`/api/availability?teacherId=${teacherId}`).then((r) => r.json()),
        fetch("/api/teachers").then((r) => r.json()),
      ]);

      setSlots(slotsRes);

      const t = teachersRes.find((t: Teacher) => t.id === teacherId);
      setTeacher(t || null);

      // Build availability map - default to UNAVAILABLE
      const map: Record<string, boolean> = {};
      for (let day = 0; day < 7; day++) {
        for (const slot of slotsRes) {
          map[`${day}-${slot.startTime}`] = false;
        }
      }
      // Apply saved availability
      for (const a of availRes) {
        map[`${a.dayOfWeek}-${a.startTime}`] = a.isAvailable;
      }
      setAvailability(map);
      setLoading(false);
    }
    fetchData();
  }, [teacherId]);

  function toggleSlot(day: number, startTime: string) {
    const key = `${day}-${startTime}`;
    setAvailability((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setAllDay(day: number, available: boolean) {
    setAvailability((prev) => {
      const next = { ...prev };
      for (const slot of slots) {
        next[`${day}-${slot.startTime}`] = available;
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const entries: AvailabilityEntry[] = [];
    for (let day = 0; day < 6; day++) {
      for (const slot of slots) {
        const key = `${day}-${slot.startTime}`;
        entries.push({
          dayOfWeek: day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isAvailable: availability[key] ?? false,
        });
      }
    }

    await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId, availability: entries }),
    });

    setSaving(false);
    alert("Availability saved!");
  }

  // Calculate summary stats
  function getSummary() {
    const daysAvailable: string[] = [];
    let totalSlots = 0;
    let totalHours = 0;

    for (let day = 0; day < 6; day++) {
      let dayHasSlot = false;
      for (const slot of slots) {
        const key = `${day}-${slot.startTime}`;
        if (availability[key]) {
          dayHasSlot = true;
          totalSlots++;
          // Calculate hours from startTime/endTime
          const [sh, sm] = slot.startTime.split(":").map(Number);
          const [eh, em] = slot.endTime.split(":").map(Number);
          totalHours += (eh * 60 + em - sh * 60 - sm) / 60;
        }
      }
      if (dayHasSlot) daysAvailable.push(DAYS_OF_WEEK[day]);
    }

    return { daysAvailable, totalSlots, totalHours: Math.round(totalHours * 10) / 10 };
  }

  if (loading) {
    return (
      <div>
        <Header title="Teacher Availability" />
        <div className="p-6 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  const summary = getSummary();

  return (
    <div>
      <Header title={`Availability - ${teacher?.user?.name || "Teacher"}`} />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {teacher?.user?.name}&apos;s Availability
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {teacher?.employmentType === "FULL_TIME" ? "Full-time" : "Part-time"} teacher &middot; Click cells to toggle availability
            </p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
            {saving ? "Saving..." : "Save Availability"}
          </button>
        </div>

        {/* Availability Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Available Days</div>
            <div className="text-lg font-bold text-gray-900">{summary.daysAvailable.length} days/week</div>
            <div className="text-xs text-gray-400 mt-1">{summary.daysAvailable.join(", ") || "None set"}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Total Available Slots</div>
            <div className="text-lg font-bold text-gray-900">{summary.totalSlots} slots/week</div>
            <div className="text-xs text-gray-400 mt-1">{summary.totalSlots} x 1.5h each</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Total Available Hours</div>
            <div className="text-lg font-bold text-gray-900">{summary.totalHours} hrs/week</div>
            <div className="text-xs text-gray-400 mt-1">Maximum teachable hours</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 sticky left-0 bg-gray-50">Time Slot</th>
                {DAYS_OF_WEEK.slice(0, 6).map((day, i) => (
                  <th key={i} className="text-center px-2 py-3 text-sm font-medium text-gray-500 min-w-[110px]">
                    <div>{day}</div>
                    <div className="flex gap-1 justify-center mt-1">
                      <button onClick={() => setAllDay(i, true)} className="text-[10px] text-green-600 hover:underline">All</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setAllDay(i, false)} className="text-[10px] text-red-600 hover:underline">None</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.id} className="border-b border-gray-100">
                  <td className="px-4 py-2 text-sm font-medium text-gray-700 sticky left-0 bg-white whitespace-nowrap">
                    <div>{slot.label}</div>
                    <div className="text-xs text-gray-400">{slot.startTime} - {slot.endTime}</div>
                  </td>
                  {DAYS_OF_WEEK.slice(0, 6).map((_, dayIndex) => {
                    const key = `${dayIndex}-${slot.startTime}`;
                    const isAvailable = availability[key] ?? false;
                    return (
                      <td key={dayIndex} className="px-2 py-2 text-center">
                        <button onClick={() => toggleSlot(dayIndex, slot.startTime)}
                          className={`w-full py-3 rounded-lg text-xs font-medium transition ${
                            isAvailable
                              ? "bg-green-100 text-green-700 hover:bg-green-200 border border-green-200"
                              : "bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-400 border border-gray-100"
                          }`}>
                          {isAvailable ? "Available" : "-"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-200"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-gray-50 border border-gray-100"></div>
            <span>Unavailable</span>
          </div>
        </div>
      </div>
    </div>
  );
}
