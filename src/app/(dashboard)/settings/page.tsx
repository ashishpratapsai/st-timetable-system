"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";

export default function SettingsPage() {
  const [provider, setProvider] = useState<"claude" | "gemini">("gemini");
  const [claudeKey, setClaudeKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [maskedClaudeKey, setMaskedClaudeKey] = useState("");
  const [maskedGeminiKey, setMaskedGeminiKey] = useState("");
  const [hasClaudeKey, setHasClaudeKey] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.ai_provider) setProvider(data.ai_provider as "claude" | "gemini");
        if (data.has_api_key === "true") {
          setHasClaudeKey(true);
          setMaskedClaudeKey(data.claude_api_key_masked);
        }
        if (data.has_gemini_key === "true") {
          setHasGeminiKey(true);
          setMaskedGeminiKey(data.gemini_api_key_masked);
        }
        if (data.ai_custom_prompt) setCustomPrompt(data.ai_custom_prompt);
      });
  }, []);

  async function handleSaveProvider(newProvider: "claude" | "gemini") {
    setProvider(newProvider);
    setTestResult(null);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "ai_provider", value: newProvider }),
    });
  }

  async function handleSaveKey(keyType: "claude" | "gemini") {
    const key = keyType === "claude" ? claudeKey : geminiKey;
    if (!key) return;
    setSaving(true);
    const settingKey = keyType === "claude" ? "claude_api_key" : "gemini_api_key";
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: settingKey, value: key }),
    });
    setSaving(false);
    const masked = key.slice(0, 8) + "..." + key.slice(-4);
    if (keyType === "claude") {
      setHasClaudeKey(true);
      setMaskedClaudeKey(masked);
      setClaudeKey("");
    } else {
      setHasGeminiKey(true);
      setMaskedGeminiKey(masked);
      setGeminiKey("");
    }
    alert("API key saved!");
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-ai", { method: "POST" });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: "Failed to connect" });
    }
    setTesting(false);
  }

  async function handleSavePrompt() {
    setSavingPrompt(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "ai_custom_prompt", value: customPrompt }),
    });
    setSavingPrompt(false);
    alert("AI instructions saved!");
  }

  const activeHasKey = provider === "claude" ? hasClaudeKey : hasGeminiKey;

  return (
    <div>
      <Header title="Settings" />
      <div className="p-6 animate-fadeIn">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">Settings</h1>

        {/* Provider Selection */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-6 max-w-2xl mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">AI Provider</h2>
          <p className="text-sm text-slate-500 mb-4">
            Choose which AI model to use for timetable generation.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSaveProvider("gemini")}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                provider === "gemini"
                  ? "border-blue-500 bg-gradient-to-br from-blue-50 to-white shadow-md shadow-blue-500/10 ring-1 ring-blue-500/20"
                  : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-900">Gemini 2.0 Flash</span>
                <span className="text-xs bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-medium border border-emerald-200/60">Free</span>
              </div>
              <p className="text-xs text-slate-500">Google AI. Fast, free tier with generous limits. Great for structured output.</p>
              {provider === "gemini" && (
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs text-blue-600 font-medium">Active</span>
                </div>
              )}
            </button>

            <button
              onClick={() => handleSaveProvider("claude")}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                provider === "claude"
                  ? "border-violet-500 bg-gradient-to-br from-violet-50 to-white shadow-md shadow-violet-500/10 ring-1 ring-violet-500/20"
                  : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-900">Claude Sonnet</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium border border-slate-200/60">Paid</span>
              </div>
              <p className="text-xs text-slate-500">Anthropic AI. Premium quality, paid per token. Best reasoning.</p>
              {provider === "claude" && (
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                  <span className="text-xs text-violet-600 font-medium">Active</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Gemini API Key */}
        <div className={`bg-white rounded-2xl border border-slate-200/70 shadow p-6 max-w-2xl mb-6 ${provider !== "gemini" ? "opacity-60" : ""}`}>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Gemini API Key</h2>
          <p className="text-sm text-slate-500 mb-4">
            Get a free API key from{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              aistudio.google.com/apikey
            </a>
          </p>

          {hasGeminiKey && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-700">
                API key configured: <code className="bg-green-100 px-1 rounded">{maskedGeminiKey}</code>
              </p>
            </div>
          )}

          <div className="flex gap-3 mb-4">
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder={hasGeminiKey ? "Enter new key to replace existing" : "AIza..."}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 text-sm"
            />
            <button onClick={() => handleSaveKey("gemini")} disabled={!geminiKey || saving}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium disabled:opacity-50">
              {saving ? "Saving..." : "Save Key"}
            </button>
          </div>
        </div>

        {/* Claude API Key */}
        <div className={`bg-white rounded-2xl border border-slate-200/70 shadow p-6 max-w-2xl mb-6 ${provider !== "claude" ? "opacity-60" : ""}`}>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Claude API Key</h2>
          <p className="text-sm text-slate-500 mb-4">
            Get your key from{" "}
            <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              console.anthropic.com
            </a>
          </p>

          {hasClaudeKey && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-700">
                API key configured: <code className="bg-green-100 px-1 rounded">{maskedClaudeKey}</code>
              </p>
            </div>
          )}

          <div className="flex gap-3 mb-4">
            <input
              type="password"
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
              placeholder={hasClaudeKey ? "Enter new key to replace existing" : "sk-ant-api03-..."}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 text-sm"
            />
            <button onClick={() => handleSaveKey("claude")} disabled={!claudeKey || saving}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium disabled:opacity-50">
              {saving ? "Saving..." : "Save Key"}
            </button>
          </div>
        </div>

        {/* Test Connection */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Test Connection</h2>
          <p className="text-sm text-slate-500 mb-4">
            Test the currently selected provider ({provider === "gemini" ? "Gemini" : "Claude"}).
          </p>
          <button onClick={handleTest} disabled={testing || !activeHasKey}
            className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-all duration-200 text-sm font-medium disabled:opacity-50 flex items-center gap-2">
            {testing && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            )}
            {testing ? "Testing..." : "Test Connection"}
          </button>
          {testResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {testResult.message}
            </div>
          )}
        </div>

        {/* AI Custom Prompt */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow p-6 max-w-2xl mt-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">AI Timetable Instructions</h2>
          <p className="text-sm text-slate-500 mb-4">
            Add custom instructions for the AI when generating timetables. These will be appended as additional constraints.
          </p>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g., Put Physics classes in the morning slots. Give Amit Sharma Mondays off. Spread Maths across at least 3 different days."
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 text-sm resize-none"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-400">{customPrompt.length}/500 characters</span>
            <button onClick={handleSavePrompt} disabled={savingPrompt}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 text-sm font-medium disabled:opacity-50">
              {savingPrompt ? "Saving..." : "Save Instructions"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
