"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/header";

type Tab = "teachers" | "assignments" | "timetable";

interface ImportError {
  row: number;
  message: string;
}

interface ImportResult {
  imported: number;
  errors: ImportError[];
}

interface ParsedRow {
  cells: string[];
  valid: boolean;
  error?: string;
}

const TEMPLATES: Record<Tab, { headers: string[]; sampleRow: string[]; filename: string }> = {
  teachers: {
    headers: ["name", "email", "phone", "employmentType", "shortCode", "hourlyRate", "subjects"],
    sampleRow: ["John Doe", "john@example.com", "9876543210", "FULL_TIME", "JDE", "1000", "PHY,MAT"],
    filename: "teachers_template.csv",
  },
  assignments: {
    headers: ["teacherEmail", "batchName", "subjectCode", "totalHours", "startDate", "endDate"],
    sampleRow: ["john@example.com", "IIT-JEE Alpha", "PHY", "150", "2026-03-01", "2026-08-31"],
    filename: "assignments_template.csv",
  },
  timetable: {
    headers: ["batchName", "subjectCode", "teacherEmail", "classroomName", "dayOfWeek", "startTime", "endTime", "classType", "weekStart"],
    sampleRow: ["IIT-JEE Alpha", "PHY", "john@example.com", "Room A1", "Monday", "09:00", "10:30", "ACTUAL", "2026-03-02"],
    filename: "timetable_template.csv",
  },
};

const API_ENDPOINTS: Record<Tab, string> = {
  teachers: "/api/import/teachers",
  assignments: "/api/import/assignments",
  timetable: "/api/import/timetable",
};

const TAB_LABELS: Record<Tab, string> = {
  teachers: "Teachers",
  assignments: "Teaching Assignments",
  timetable: "Timetable Entries",
};

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  teachers: "Import teachers with their subject assignments. Each row creates a User (role=TEACHER) and Teacher record. Subjects are matched by code (e.g., PHY, MAT, CHE).",
  assignments: "Import teaching assignments linking teachers to batches and subjects. Teachers are matched by email, batches by name, and subjects by code.",
  timetable: "Import timetable entries with conflict checking. Validates teacher and classroom double-bookings. dayOfWeek can be 0-6 or Monday-Saturday.",
};

function parseCSVClient(text: string): string[][] {
  const lines = text.trim().split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => line.split(",").map((cell) => cell.trim()));
}

function validateRow(tab: Tab, headers: string[], cells: string[]): { valid: boolean; error?: string } {
  const get = (name: string) => {
    const idx = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    return idx !== -1 ? cells[idx]?.trim() || "" : "";
  };

  if (tab === "teachers") {
    if (!get("name")) return { valid: false, error: "Name is required" };
    if (!get("email")) return { valid: false, error: "Email is required" };
    const email = get("email");
    if (!email.includes("@")) return { valid: false, error: "Invalid email format" };
    const empType = get("employmentType").toUpperCase();
    if (empType && empType !== "FULL_TIME" && empType !== "PART_TIME") {
      return { valid: false, error: "employmentType must be FULL_TIME or PART_TIME" };
    }
    const rate = get("hourlyRate");
    if (rate && isNaN(parseFloat(rate))) {
      return { valid: false, error: "hourlyRate must be a number" };
    }
  }

  if (tab === "assignments") {
    if (!get("teacherEmail")) return { valid: false, error: "teacherEmail is required" };
    if (!get("batchName")) return { valid: false, error: "batchName is required" };
    if (!get("subjectCode")) return { valid: false, error: "subjectCode is required" };
    if (!get("totalHours") || isNaN(parseInt(get("totalHours")))) {
      return { valid: false, error: "totalHours must be a number" };
    }
    if (!get("startDate")) return { valid: false, error: "startDate is required" };
    if (!get("endDate")) return { valid: false, error: "endDate is required" };
    if (isNaN(new Date(get("startDate")).getTime())) return { valid: false, error: "Invalid startDate" };
    if (isNaN(new Date(get("endDate")).getTime())) return { valid: false, error: "Invalid endDate" };
  }

  if (tab === "timetable") {
    if (!get("batchName")) return { valid: false, error: "batchName is required" };
    if (!get("subjectCode")) return { valid: false, error: "subjectCode is required" };
    if (!get("teacherEmail")) return { valid: false, error: "teacherEmail is required" };
    if (!get("classroomName")) return { valid: false, error: "classroomName is required" };
    if (!get("dayOfWeek")) return { valid: false, error: "dayOfWeek is required" };
    if (!get("startTime")) return { valid: false, error: "startTime is required" };
    if (!get("endTime")) return { valid: false, error: "endTime is required" };
    if (!get("weekStart")) return { valid: false, error: "weekStart is required" };
    const dow = get("dayOfWeek");
    const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const num = parseInt(dow);
    if (!dayNames.includes(dow.toLowerCase()) && (isNaN(num) || num < 0 || num > 6)) {
      return { valid: false, error: "dayOfWeek must be 0-6 or Monday-Sunday" };
    }
    const ct = get("classType").toUpperCase();
    if (ct && !["ACTUAL", "REVISION", "DOUBT", ""].includes(ct)) {
      return { valid: false, error: "classType must be ACTUAL, REVISION, or DOUBT" };
    }
    if (isNaN(new Date(get("weekStart")).getTime())) return { valid: false, error: "Invalid weekStart date" };
  }

  return { valid: true };
}

export default function ImportPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("teachers");
  const [csvText, setCsvText] = useState("");
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsed, setIsParsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [apiError, setApiError] = useState("");

  const isAdmin = session?.user?.role === "ADMIN";

  if (!isAdmin) {
    return (
      <div>
        <Header title="CSV Import" />
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <h2 className="text-lg font-semibold text-red-800 mb-1">Access Denied</h2>
            <p className="text-sm text-red-600">Only administrators can access the CSV import feature.</p>
          </div>
        </div>
      </div>
    );
  }

  function downloadTemplate() {
    const tmpl = TEMPLATES[activeTab];
    const csv = tmpl.headers.join(",") + "\n" + tmpl.sampleRow.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tmpl.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      setIsParsed(false);
      setResult(null);
      setApiError("");
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    e.target.value = "";
  }

  function handleParse() {
    if (!csvText.trim()) return;
    const rows = parseCSVClient(csvText);
    if (rows.length < 2) {
      setApiError("CSV must have a header row and at least one data row");
      return;
    }

    const headers = rows[0];
    setParsedHeaders(headers);

    const dataRows: ParsedRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      const { valid, error } = validateRow(activeTab, headers, cells);
      dataRows.push({ cells, valid, error });
    }

    setParsedRows(dataRows);
    setIsParsed(true);
    setResult(null);
    setApiError("");
  }

  async function handleImport() {
    if (!csvText.trim()) return;
    setImporting(true);
    setResult(null);
    setApiError("");

    try {
      const res = await fetch(API_ENDPOINTS[activeTab], {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: csvText,
      });

      const data = await res.json();

      if (!res.ok) {
        setApiError(data.error || "Import failed");
      } else {
        setResult(data);
      }
    } catch {
      setApiError("Network error — could not reach the server");
    }

    setImporting(false);
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setCsvText("");
    setParsedHeaders([]);
    setParsedRows([]);
    setIsParsed(false);
    setResult(null);
    setApiError("");
  }

  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.filter((r) => !r.valid).length;

  return (
    <div>
      <Header title="CSV Bulk Import" />
      <div className="p-3 sm:p-4 md:p-6 animate-fadeIn">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CSV Bulk Import</h1>
            <p className="text-sm text-slate-500 mt-1">Import teachers, assignments, and timetable entries from CSV files</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-1.5 mb-6 inline-flex gap-1">
          {(["teachers", "assignments", "timetable"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Description */}
        <div className="bg-blue-50 border border-blue-200/60 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <p className="text-sm text-blue-800">{TAB_DESCRIPTIONS[activeTab]}</p>
          </div>
        </div>

        {/* Step 1: Download Template & Input */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Step 1: Prepare CSV Data</h2>
              <p className="text-sm text-slate-500 mt-0.5">Download the template or paste your CSV content below</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-all duration-200 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download Template
            </button>
          </div>

          {/* File Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Upload CSV File</label>
            <div className="relative">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer cursor-pointer border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Or Paste CSV Content</label>
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setIsParsed(false);
                setResult(null);
                setApiError("");
              }}
              placeholder={TEMPLATES[activeTab].headers.join(",") + "\n" + TEMPLATES[activeTab].sampleRow.join(",")}
              rows={8}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 text-sm font-mono resize-none"
            />
          </div>

          {/* Expected Columns */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-xs text-slate-500 mr-1">Expected columns:</span>
            {TEMPLATES[activeTab].headers.map((h) => (
              <span key={h} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">{h}</span>
            ))}
          </div>
        </div>

        {/* Step 2: Parse & Preview */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Step 2: Parse & Preview</h2>
              <p className="text-sm text-slate-500 mt-0.5">Review your data before importing</p>
            </div>
            <button
              onClick={handleParse}
              disabled={!csvText.trim()}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              Parse & Preview
            </button>
          </div>

          {apiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          {isParsed && parsedRows.length > 0 && (
            <>
              {/* Validation Summary */}
              <div className="flex gap-3 mb-4">
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-slate-500">Total Rows:</span>
                  <span className="text-sm font-semibold text-slate-900">{parsedRows.length}</span>
                </div>
                <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span className="text-sm text-green-700 font-medium">{validCount} Valid</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                    <span className="text-sm text-red-700 font-medium">{invalidCount} Errors</span>
                  </div>
                )}
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">
                        #
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">
                        Status
                      </th>
                      {parsedHeaders.map((h, idx) => (
                        <th key={idx} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`${row.valid ? "hover:bg-slate-50" : "bg-red-50/50"} transition-colors`}
                      >
                        <td className="px-3 py-2 text-slate-400 font-mono text-xs">{idx + 2}</td>
                        <td className="px-3 py-2">
                          {row.valid ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
                              <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            </span>
                          ) : (
                            <span className="group relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 cursor-help">
                              <svg className="w-3 h-3 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-red-800 text-white text-xs rounded whitespace-nowrap hidden group-hover:block z-10">
                                {row.error}
                              </span>
                            </span>
                          )}
                        </td>
                        {row.cells.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                            {cell || <span className="text-slate-300 italic">empty</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {isParsed && parsedRows.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p>No data rows found in the CSV</p>
            </div>
          )}
        </div>

        {/* Step 3: Import */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Step 3: Import</h2>
              <p className="text-sm text-slate-500 mt-0.5">Send parsed data to the server for import</p>
            </div>
            <button
              onClick={handleImport}
              disabled={!csvText.trim() || importing}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-5 py-2.5 rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Importing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  Import Data
                </>
              )}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Success summary */}
              <div className={`rounded-xl p-4 ${result.imported > 0 ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                <div className="flex items-center gap-3">
                  {result.imported > 0 ? (
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <h3 className={`font-semibold ${result.imported > 0 ? "text-green-800" : "text-amber-800"}`}>
                      Import Complete
                    </h3>
                    <p className={`text-sm ${result.imported > 0 ? "text-green-700" : "text-amber-700"}`}>
                      Successfully imported <span className="font-bold">{result.imported}</span> record{result.imported !== 1 ? "s" : ""}.
                      {result.errors.length > 0 && (
                        <> <span className="font-bold">{result.errors.length}</span> row{result.errors.length !== 1 ? "s" : ""} had errors.</>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Error details */}
              {result.errors.length > 0 && (
                <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
                  <div className="bg-red-50 px-4 py-2.5 border-b border-red-200">
                    <h4 className="text-sm font-semibold text-red-800">Error Details</h4>
                  </div>
                  <div className="divide-y divide-red-100 max-h-64 overflow-y-auto">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="px-4 py-2.5 flex items-start gap-3">
                        <span className="text-xs text-red-400 font-mono bg-red-50 px-2 py-0.5 rounded flex-shrink-0">
                          Row {err.row}
                        </span>
                        <span className="text-sm text-red-700">{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
