"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";

interface DailyEntry {
  startTime: string;
  endTime: string;
  subject: string;
  batch: string;
  classType: string;
}

interface DailyBreakdown {
  date: string;
  dayOfWeek: number;
  classes: number;
  hours: number;
  classTypes: Record<string, number>;
  entries: DailyEntry[];
}

interface EarningsData {
  teacherId: string;
  teacherName: string;
  hourlyRate: number;
  totalHours: number;
  totalEarned: number;
  dailyBreakdown: DailyBreakdown[];
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const CLASS_TYPE_LABELS: Record<string, string> = {
  ACTUAL: "Actual",
  REVISION: "Revision",
  DOUBT: "Doubt",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export default function MyEarningsPage() {
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const defaults = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);

  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const res = await fetch(`/api/my-earnings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEarningsData(data);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to load earnings data");
      }
    } catch {
      setError("Failed to load earnings data");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return (
    <div>
      <Header title="My Earnings" />
      <div className="p-3 sm:p-4 md:p-6 animate-fadeIn">
        <h1 className="text-2xl font-bold gradient-text mb-6">My Earnings</h1>

        {/* Date Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-6 mb-6 animate-slideUp">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              />
            </div>
            <button
              onClick={fetchEarnings}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-slate-200/70 shadow p-6"
                >
                  <div className="h-6 skeleton w-24 mb-2" />
                  <div className="h-8 skeleton w-32" />
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-6">
              <div className="space-y-4">
                <div className="h-10 skeleton w-full" />
                <div className="h-10 skeleton w-full opacity-75" />
                <div className="h-10 skeleton w-full opacity-50" />
              </div>
            </div>
          </div>
        ) : earningsData ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-6 animate-slideUp">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Hours This Period
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {earningsData.totalHours}
                      <span className="text-sm font-normal text-slate-400 ml-1">
                        hrs
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-6 animate-slideUp">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-emerald-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Earnings
                    </p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(earningsData.totalEarned)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-6 animate-slideUp">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-violet-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Rate
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(earningsData.hourlyRate)}
                      <span className="text-sm font-normal text-slate-400 ml-1">
                        /hr
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Breakdown Table */}
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow overflow-hidden animate-slideUp">
              {earningsData.dailyBreakdown.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                      />
                    </svg>
                  </div>
                  <p className="text-slate-500 font-medium">
                    No classes found for this period
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Try adjusting the date range
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50">
                        <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                          Date
                        </th>
                        <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                          Day
                        </th>
                        <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                          Classes
                        </th>
                        <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                          Hours
                        </th>
                        <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                          Class Types
                        </th>
                        <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {earningsData.dailyBreakdown.map((day) => (
                        <>
                          <tr
                            key={day.date}
                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() =>
                              setExpandedDate(
                                expandedDate === day.date ? null : day.date
                              )
                            }
                          >
                            <td className="px-6 py-4 font-medium text-slate-900 text-sm">
                              {formatDate(day.date)}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {DAYS_OF_WEEK[day.dayOfWeek]}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
                                {day.classes}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">
                              {day.hours}
                              <span className="text-slate-400 ml-1">hrs</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(day.classTypes).map(
                                  ([type, count]) => (
                                    <span
                                      key={type}
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        type === "ACTUAL"
                                          ? "bg-blue-50 text-blue-700"
                                          : type === "REVISION"
                                          ? "bg-amber-50 text-amber-700"
                                          : "bg-violet-50 text-violet-700"
                                      }`}
                                    >
                                      {count}{" "}
                                      {CLASS_TYPE_LABELS[type] || type}
                                    </span>
                                  )
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <svg
                                className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                                  expandedDate === day.date ? "rotate-180" : ""
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                                />
                              </svg>
                            </td>
                          </tr>
                          {expandedDate === day.date && (
                            <tr key={`${day.date}-details`}>
                              <td
                                colSpan={6}
                                className="px-6 py-3 bg-slate-50/80"
                              >
                                <div className="space-y-2 pl-4 border-l-2 border-blue-200">
                                  {day.entries.map((entry, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-4 text-sm"
                                    >
                                      <span className="text-slate-500 font-mono text-xs w-28">
                                        {entry.startTime} - {entry.endTime}
                                      </span>
                                      <span className="font-medium text-slate-800">
                                        {entry.subject}
                                      </span>
                                      <span className="text-slate-400">|</span>
                                      <span className="text-slate-600">
                                        {entry.batch}
                                      </span>
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                          entry.classType === "ACTUAL"
                                            ? "bg-blue-50 text-blue-700"
                                            : entry.classType === "REVISION"
                                            ? "bg-amber-50 text-amber-700"
                                            : "bg-violet-50 text-violet-700"
                                        }`}
                                      >
                                        {CLASS_TYPE_LABELS[entry.classType] ||
                                          entry.classType}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/80 border-t-2 border-slate-200">
                        <td
                          className="px-6 py-4 font-bold text-slate-900"
                          colSpan={2}
                        >
                          Monthly Total
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">
                          {earningsData.dailyBreakdown.reduce(
                            (sum, d) => sum + d.classes,
                            0
                          )}{" "}
                          classes
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">
                          {earningsData.totalHours} hrs
                        </td>
                        <td
                          className="px-6 py-4 font-bold text-emerald-600 text-lg"
                          colSpan={2}
                        >
                          {formatCurrency(earningsData.totalEarned)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
