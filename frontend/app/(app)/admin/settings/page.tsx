"use client";

import { useState, useEffect } from "react";
import { Settings, Save, ShieldCheck, Bell, Database, Globe, Key, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const LS_KEY = "ns_admin_settings";

interface SettingRow {
  key: string;
  label: string;
  description: string;
  type: "toggle" | "text" | "select";
  options?: string[];
}

const GENERAL_SETTINGS: SettingRow[] = [
  { key: "app_name", label: "Application Name", description: "Display name for the platform", type: "text" },
  { key: "default_state", label: "Default State/UT", description: "Pre-selected state in forms", type: "text" },
  { key: "judgment_language", label: "Judgment Language", description: "Primary language for AI extraction", type: "select", options: ["English", "Hindi", "Mixed"] },
];

const REVIEW_SETTINGS: SettingRow[] = [
  { key: "auto_verify_high_confidence", label: "Auto-verify High Confidence", description: "Automatically approve directives with confidence ≥ 90%", type: "toggle" },
  { key: "require_notes_on_reject", label: "Require Notes on Reject", description: "Reviewer must add notes when rejecting a directive", type: "toggle" },
  { key: "default_deadline_days", label: "Default Deadline (days)", description: "Default deadline if not extracted from judgment", type: "text" },
];

const NOTIFICATION_SETTINGS: SettingRow[] = [
  { key: "email_on_ingest", label: "Email on Ingest", description: "Notify reviewers when a new case is ingested", type: "toggle" },
  { key: "email_on_deadline", label: "Deadline Reminders", description: "Send alerts 7 days before directive deadlines", type: "toggle" },
  { key: "email_on_verify", label: "Email on Verification", description: "Notify departments when their case is verified", type: "toggle" },
];

const SECURITY_SETTINGS: SettingRow[] = [
  { key: "audit_chain", label: "Immutable Audit Chain", description: "SHA-256 hash chain for all events (always on)", type: "toggle" },
  { key: "session_timeout", label: "Session Timeout (hours)", description: "Auto-logout after inactivity", type: "text" },
  { key: "mfa_for_admin", label: "MFA for Admins", description: "Require multi-factor auth for ADMIN role", type: "toggle" },
];

const DEFAULT_TOGGLES: Record<string, boolean> = {
  auto_verify_high_confidence: false,
  require_notes_on_reject: true,
  email_on_ingest: true,
  email_on_deadline: true,
  email_on_verify: false,
  audit_chain: true,
  mfa_for_admin: false,
};

const DEFAULT_TEXT: Record<string, string> = {
  app_name: "NyayaSetu",
  default_state: "",
  judgment_language: "English",
  default_deadline_days: "30",
  session_timeout: "8",
};

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toggles, setToggles] = useState<Record<string, boolean>>(DEFAULT_TOGGLES);
  const [textVals, setTextVals] = useState<Record<string, string>>(DEFAULT_TEXT);

  // Load from localStorage on mount (and try backend)
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.toggles) setToggles(parsed.toggles);
        if (parsed.textVals) setTextVals(parsed.textVals);
      } catch { /* ignore */ }
    }
    // Also try loading from backend (gracefully ignore if endpoint not yet live)
    api.admin.getSettings()
      .then((remote) => {
        if (remote.toggles) setToggles(remote.toggles as Record<string, boolean>);
        if (remote.textVals) setTextVals(remote.textVals as Record<string, string>);
      })
      .catch(() => { /* backend endpoint optional — localStorage is the fallback */ });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const payload = { toggles, textVals };
    // Persist locally immediately
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    // Best-effort sync to backend
    api.admin.saveSettings(payload).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (user?.role !== "ADMIN") {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-3">
        <ShieldCheck className="w-12 h-12 text-slate-200" />
        <p className="font-medium">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
            <Settings className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">System Settings</h1>
            <p className="text-slate-500 text-xs">Platform configuration · Admin only</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors",
            saved
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          )}
        >
          {saved
            ? <><RefreshCw className="w-3.5 h-3.5" /> Saved!</>
            : saving
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</>
            : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <SettingsGroup icon={Globe} title="General" settings={GENERAL_SETTINGS} toggles={toggles} textVals={textVals} setToggles={setToggles} setTextVals={setTextVals} />
        <SettingsGroup icon={ShieldCheck} title="Review Workflow" settings={REVIEW_SETTINGS} toggles={toggles} textVals={textVals} setToggles={setToggles} setTextVals={setTextVals} />
        <SettingsGroup icon={Bell} title="Notifications" settings={NOTIFICATION_SETTINGS} toggles={toggles} textVals={textVals} setToggles={setToggles} setTextVals={setTextVals} />
        <SettingsGroup icon={Key} title="Security & Audit" settings={SECURITY_SETTINGS} toggles={toggles} textVals={textVals} setToggles={setToggles} setTextVals={setTextVals} />

        {/* DB / System info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">System Information</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: "Backend", value: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api" },
              { label: "Version", value: "1.0.0 · NyayaSetu" },
              { label: "Database", value: "PostgreSQL via asyncpg" },
              { label: "Storage", value: "MinIO (S3-compatible)" },
              { label: "AI Engine", value: "Gemini Flash / GPT-4o" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">{label}</span>
                <span className="text-sm font-mono text-slate-700">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsGroup({
  icon: Icon, title, settings, toggles, textVals, setToggles, setTextVals,
}: {
  icon: React.ElementType;
  title: string;
  settings: SettingRow[];
  toggles: Record<string, boolean>;
  textVals: Record<string, string>;
  setToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setTextVals: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {settings.map((s) => (
          <div key={s.key} className="flex items-center justify-between px-5 py-4">
            <div className="flex-1 min-w-0 mr-6">
              <p className="text-sm font-medium text-slate-800">{s.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
            </div>
            {s.type === "toggle" && (
              <button
                onClick={() => setToggles((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                disabled={s.key === "audit_chain"}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                  toggles[s.key] ? "bg-indigo-600" : "bg-slate-200",
                  s.key === "audit_chain" && "opacity-60 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    toggles[s.key] ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            )}
            {(s.type === "text") && (
              <input
                type="text"
                value={textVals[s.key] ?? ""}
                onChange={(e) => setTextVals((prev) => ({ ...prev, [s.key]: e.target.value }))}
                className="w-40 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
            {s.type === "select" && (
              <select
                value={textVals[s.key] ?? ""}
                onChange={(e) => setTextVals((prev) => ({ ...prev, [s.key]: e.target.value }))}
                className="w-40 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {s.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
