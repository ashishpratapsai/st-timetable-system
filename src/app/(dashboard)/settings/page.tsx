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

  const activeHasKey = provider === "claude" ? hasClaudeKey : hasGeminiKey;

  return (
    <div>
      <Header title="Settings" />
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Provider Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">AI Provider</h2>
          <p className="text-sm text-gray-500 mb-4">
            Choose which AI model to use for timetable generation.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSaveProvider("gemini")}
              className={`p-4 rounded-lg border-2 text-left transition ${
                provider === "gemini"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">Gemini 2.0 Flash</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Free</span>
              </div>
              <p className="text-xs text-gray-500">Google AI. Fast, free tier with generous limits. Great for structured output.</p>
            </button>

            <button
              onClick={() => handleSaveProvider("claude")}
              className={`p-4 rounded-lg border-2 text-left transition ${
                provider === "claude"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">Claude Sonnet</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Paid</span>
              </div>
              <p className="text-xs text-gray-500">Anthropic AI. Premium quality, paid per token. Best reasoning.</p>
            </button>
          </div>
        </div>

        {/* Gemini API Key */}
        <div className={`bg-white rounded-xl border border-gray-200 p-6 max-w-2xl mb-6 ${provider !== "gemini" ? "opacity-60" : ""}`}>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Gemini API Key</h2>
          <p className="text-sm text-gray-500 mb-4">
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
            <button onClick={() => handleSaveKey("gemini")} disabled={!geminiKey || saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
              {saving ? "Saving..." : "Save Key"}
            </button>
          </div>
        </div>

        {/* Claude API Key */}
        <div className={`bg-white rounded-xl border border-gray-200 p-6 max-w-2xl mb-6 ${provider !== "claude" ? "opacity-60" : ""}`}>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Claude API Key</h2>
          <p className="text-sm text-gray-500 mb-4">
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
            <button onClick={() => handleSaveKey("claude")} disabled={!claudeKey || saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
              {saving ? "Saving..." : "Save Key"}
            </button>
          </div>
        </div>

        {/* Test Connection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Test Connection</h2>
          <p className="text-sm text-gray-500 mb-4">
            Test the currently selected provider ({provider === "gemini" ? "Gemini" : "Claude"}).
          </p>
          <button onClick={handleTest} disabled={testing || !activeHasKey}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-medium disabled:opacity-50">
            {testing ? "Testing..." : "Test Connection"}
          </button>
          {testResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {testResult.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
