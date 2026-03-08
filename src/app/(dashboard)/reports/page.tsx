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
      <div className="p-3 sm:p-4 md:p-6 animate-fadeIn">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">Reports & Analytics</h1>

        {/* Faculty Utilization */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Faculty Utilization</h2>
          {loading ? (
            <div className="py-12 space-y-4">
              <div className="h-10 skeleton w-full max-w-2xl mx-auto" />
              <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-75" />
              <div className="h-10 skeleton w-full max-w-2xl mx-auto opacity-50" />
            </div>
          ) : utilization.length === 0 ? (
            <p className="text-slate-400">No data available. Generate a timetable first.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Teacher</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Scheduled Hours/Week</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Leaves</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Leaves</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Workload</th>
                </tr>
              </thead>
              <tbody>
                {utilization.map((t, i) => {
                  const maxHours = 30;
                  const percentage = Math.min((t.scheduledHours / maxHours) * 100, 100);
                  const barColor = percentage > 80
                    ? "bg-gradient-to-r from-red-500 to-rose-500"
                    : percentage > 60
                    ? "bg-gradient-to-r from-amber-400 to-yellow-500"
                    : "bg-gradient-to-r from-emerald-400 to-green-500";

                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                      <td className="px-4 py-3 text-slate-600">{t.scheduledHours}h</td>
                      <td className="px-4 py-3 text-slate-600">{t.totalLeaves}</td>
                      <td className="px-4 py-3 text-slate-600">{t.pendingLeaves}</td>
                      <td className="px-4 py-3 w-48">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div className={`${barColor} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-500 w-10">{Math.round(percentage)}%</span>
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
