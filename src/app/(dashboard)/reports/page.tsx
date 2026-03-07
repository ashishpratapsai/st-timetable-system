"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";

interface TeacherUtilization {
  name: string;
  scheduledHours: number;
  totalLeaves: number;
  pendingLeaves: number;
}

export default function ReportsPage() {
  const [utilization, setUtilization] = useState<TeacherUtilization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/utilization")
      .then((r) => r.json())
      .then((data) => {
        setUtilization(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <Header title="Reports" />
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports & Analytics</h1>

        {/* Faculty Utilization */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Faculty Utilization</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : utilization.length === 0 ? (
            <p className="text-gray-500">No data available. Generate a timetable first.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Teacher</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Scheduled Hours/Week</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Total Leaves</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Pending Leaves</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Workload</th>
                </tr>
              </thead>
              <tbody>
                {utilization.map((t, i) => {
                  const maxHours = 30;
                  const percentage = Math.min((t.scheduledHours / maxHours) * 100, 100);
                  const barColor = percentage > 80 ? "bg-red-500" : percentage > 60 ? "bg-yellow-500" : "bg-green-500";

                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                      <td className="px-4 py-3 text-gray-600">{t.scheduledHours}h</td>
                      <td className="px-4 py-3 text-gray-600">{t.totalLeaves}</td>
                      <td className="px-4 py-3 text-gray-600">{t.pendingLeaves}</td>
                      <td className="px-4 py-3 w-48">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div className={`${barColor} h-2 rounded-full`} style={{ width: `${percentage}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10">{Math.round(percentage)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
