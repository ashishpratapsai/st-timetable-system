"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";

interface PayrollRecord {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  shortCode: string | null;
  hourlyRate: number;
  totalHours: number;
  earned: number;
  classBreakdown: Record<string, number>;
  combinedCount: number;
  entries: Array<{
    date: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    subject: string;
    batch: string;
    classType: string;
    hours: number;
    isCombined: boolean;
  }>;
}

interface TeacherOption {
  id: string;
  user: { name: string };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const CLASS_TYPE_LABELS: Record<string, string> = {
  ACTUAL: "Actual",
  REVISION: "Revision",
  DOUBT: "Doubt",
};

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export default function PayrollPage() {
  const [pinExists, setPinExists] = useState<boolean | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [payrollToken, setPayrollToken] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  const [payrollData, setPayrollData] = useState<PayrollRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(false);

  const defaults = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [teacherFilter, setTeacherFilter] = useState("");

  // Rate editing
  const [editingRateFor, setEditingRateFor] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState("");
  const [rateSaving, setRateSaving] = useState(false);

  // Check for existing token in sessionStorage on mount
  useEffect(() => {
    const storedToken = sessionStorage.getItem("payroll_token");
    if (storedToken) {
      try {
        const decoded = JSON.parse(atob(storedToken));
        if (decoded.exp && Date.now() < decoded.exp) {
          setPayrollToken(storedToken);
          setPinVerified(true);
        } else {
          sessionStorage.removeItem("payroll_token");
        }
      } catch {
        sessionStorage.removeItem("payroll_token");
      }
    }

    // Check if PIN exists
    fetch("/api/payroll/setup-pin")
      .then((r) => r.json())
      .then((data) => setPinExists(data.exists))
      .catch(() => setPinExists(false));
  }, []);

  // Fetch teachers list
  useEffect(() => {
    fetch("/api/teachers")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTeachers(data.map((t: { id: string; user: { name: string } }) => ({ id: t.id, user: t.user })));
        }
      })
      .catch(() => {});
  }, []);

  const fetchPayroll = useCallback(async () => {
    if (!payrollToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (teacherFilter) params.set("teacherId", teacherFilter);

      const res = await fetch(`/api/payroll?${params}`, {
        headers: { "x-payroll-token": payrollToken },
      });
      if (res.ok) {
        const data = await res.json();
        setPayrollData(data);
      } else if (res.status === 403) {
        // Token expired
        setPinVerified(false);
        setPayrollToken(null);
        sessionStorage.removeItem("payroll_token");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [payrollToken, fromDate, toDate, teacherFilter]);

  // Fetch payroll data when token is verified
  useEffect(() => {
    if (pinVerified && payrollToken) {
      fetchPayroll();
    }
  }, [pinVerified, payrollToken, fetchPayroll]);

  const handleSetupPin = async () => {
    if (pinInput.length < 4) {
      setPinError("PIN must be at least 4 digits");
      return;
    }
    setPinLoading(true);
    setPinError("");
    try {
      const res = await fetch("/api/payroll/setup-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      if (res.ok) {
        setPinExists(true);
        setIsSettingUp(false);
        setPinInput("");
        // Now verify it
      } else {
        const data = await res.json();
        setPinError(data.error || "Failed to set up PIN");
      }
    } catch {
      setPinError("Failed to set up PIN");
    } finally {
      setPinLoading(false);
    }
  };

  const handleVerifyPin = async () => {
    if (!pinInput) {
      setPinError("Please enter your PIN");
      return;
    }
    setPinLoading(true);
    setPinError("");
    try {
      const res = await fetch("/api/payroll/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (data.valid && data.token) {
        setPayrollToken(data.token);
        setPinVerified(true);
        sessionStorage.setItem("payroll_token", data.token);
        setPinInput("");
      } else {
        setPinError(data.error || "Invalid PIN");
      }
    } catch {
      setPinError("Verification failed");
    } finally {
      setPinLoading(false);
    }
  };

  const handleSetRate = async (teacherId: string) => {
    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate < 0) {
      return;
    }
    setRateSaving(true);
    try {
      const res = await fetch("/api/payroll/set-rate", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-payroll-token": payrollToken || "",
        },
        body: JSON.stringify({ teacherId, hourlyRate: rate }),
      });
      if (res.ok) {
        setEditingRateFor(null);
        setRateInput("");
        fetchPayroll();
      }
    } catch {
      // ignore
    } finally {
      setRateSaving(false);
    }
  };

  // Summary calculations
  const totalHours = payrollData.reduce((sum, r) => sum + r.totalHours, 0);
  const totalPayout = payrollData.reduce((sum, r) => sum + r.earned, 0);
  const avgRate =
    payrollData.length > 0
      ? payrollData.reduce((sum, r) => sum + r.hourlyRate, 0) /
        payrollData.length
      : 0;

  // PIN Gate Modal
  if (!pinVerified) {
    return (
      <div>
        <Header title="Payroll" />
        <div className="p-3 sm:p-4 md:p-6 animate-fadeIn">
          <h1 className="text-2xl font-bold gradient-text mb-8">
            Payroll & Earnings
          </h1>

          {/* PIN Modal Overlay */}
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scaleIn">
              <div className="p-8">
                {pinExists === null ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                    <p className="text-sm text-slate-500">Loading...</p>
                  </div>
                ) : pinExists === false || isSettingUp ? (
                  <>
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
                        <svg
                          className="w-8 h-8 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">
                        Set Up Payroll PIN
                      </h3>
                      <p className="text-sm text-slate-500">
                        Create a secure PIN to protect payroll access
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          New PIN (4+ digits)
                        </label>
                        <input
                          type="password"
                          value={pinInput}
                          onChange={(e) => {
                            setPinInput(e.target.value.replace(/\D/g, ""));
                            setPinError("");
                          }}
                          placeholder="Enter PIN"
                          maxLength={8}
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center text-2xl tracking-[0.5em] font-mono transition-all duration-200"
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleSetupPin()
                          }
                        />
                      </div>
                      {pinError && (
                        <p className="text-sm text-rose-600 text-center">
                          {pinError}
                        </p>
                      )}
                      <button
                        onClick={handleSetupPin}
                        disabled={pinLoading || pinInput.length < 4}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pinLoading ? "Setting up..." : "Set PIN"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
                        <svg
                          className="w-8 h-8 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">
                        Enter Payroll PIN
                      </h3>
                      <p className="text-sm text-slate-500">
                        Enter your PIN to access payroll data
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <input
                          type="password"
                          value={pinInput}
                          onChange={(e) => {
                            setPinInput(e.target.value.replace(/\D/g, ""));
                            setPinError("");
                          }}
                          placeholder="Enter PIN"
                          maxLength={8}
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center text-2xl tracking-[0.5em] font-mono transition-all duration-200"
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleVerifyPin()
                          }
                          autoFocus
                        />
                      </div>
                      {pinError && (
                        <p className="text-sm text-rose-600 text-center">
                          {pinError}
                        </p>
                      )}
                      <button
                        onClick={handleVerifyPin}
                        disabled={pinLoading || !pinInput}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pinLoading ? "Verifying..." : "Unlock Payroll"}
                      </button>
                      <button
                        onClick={() => {
                          setIsSettingUp(true);
                          setPinInput("");
                          setPinError("");
                        }}
                        className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors py-2"
                      >
                        Reset PIN
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main payroll view
  return (
    <div>
      <Header title="Payroll" />
      <div className="p-3 sm:p-4 md:p-6 animate-fadeIn">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold gradient-text">
            Payroll & Earnings
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPinVerified(false);
                setPayrollToken(null);
                sessionStorage.removeItem("payroll_token");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 transition-all duration-200"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
              Lock
            </button>
          </div>
        </div>

        {/* Filters */}
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
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Teacher
              </label>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 min-w-[180px]"
              >
                <option value="">All Teachers</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.user.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchPayroll}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

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
                  Total Hours
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {Math.round(totalHours * 10) / 10}
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
                  Total Payout
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(totalPayout)}
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
                  Average Rate
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(avgRate)}
                  <span className="text-sm font-normal text-slate-400 ml-1">
                    /hr
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow overflow-hidden animate-slideUp">
          {loading ? (
            <div className="p-12 space-y-4">
              <div className="h-10 skeleton w-full" />
              <div className="h-10 skeleton w-full opacity-75" />
              <div className="h-10 skeleton w-full opacity-50" />
              <div className="h-10 skeleton w-full opacity-25" />
            </div>
          ) : payrollData.length === 0 ? (
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
                    d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
                  />
                </svg>
              </div>
              <p className="text-slate-500 font-medium">
                No payroll data for the selected period
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Try adjusting the date range or generate timetable entries first
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                      Teacher
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                      Hours Worked
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                      Rate (&#8377;/hr)
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                      Earned (&#8377;)
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                      Classes Breakdown
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                      Combined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {payrollData.map((record) => (
                    <tr
                      key={record.teacherId}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-semibold text-xs">
                            {record.shortCode ||
                              record.teacherName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 text-sm">
                              {record.teacherName}
                            </p>
                            <p className="text-xs text-slate-400">
                              {record.teacherEmail}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">
                          {record.totalHours}
                        </span>
                        <span className="text-sm text-slate-400 ml-1">hrs</span>
                      </td>
                      <td className="px-6 py-4">
                        {editingRateFor === record.teacherId ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={rateInput}
                              onChange={(e) => setRateInput(e.target.value)}
                              className="w-24 px-2 py-1 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="Rate"
                              min="0"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleSetRate(record.teacherId);
                                if (e.key === "Escape")
                                  setEditingRateFor(null);
                              }}
                            />
                            <button
                              onClick={() => handleSetRate(record.teacherId)}
                              disabled={rateSaving}
                              className="text-emerald-600 hover:text-emerald-700"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m4.5 12.75 6 6 9-13.5"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => setEditingRateFor(null)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18 18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">
                              {formatCurrency(record.hourlyRate)}
                            </span>
                            <button
                              onClick={() => {
                                setEditingRateFor(record.teacherId);
                                setRateInput(record.hourlyRate.toString());
                              }}
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                              title="Set Rate"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-emerald-600 text-lg">
                          {formatCurrency(record.earned)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(record.classBreakdown).map(
                            ([type, count]) => (
                              <span
                                key={type}
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  type === "ACTUAL"
                                    ? "bg-blue-50 text-blue-700"
                                    : type === "REVISION"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-violet-50 text-violet-700"
                                }`}
                              >
                                {count} {CLASS_TYPE_LABELS[type] || type}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {record.combinedCount > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            {record.combinedCount} combined
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/80 border-t-2 border-slate-200">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      Totals
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {Math.round(totalHours * 10) / 10} hrs
                    </td>
                    <td className="px-6 py-4"></td>
                    <td className="px-6 py-4 font-bold text-emerald-600 text-lg">
                      {formatCurrency(totalPayout)}
                    </td>
                    <td className="px-6 py-4"></td>
                    <td className="px-6 py-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
