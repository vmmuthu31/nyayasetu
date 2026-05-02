"use client";

import { useState } from "react";
import Link from "next/link";
import { Scale, Eye, EyeOff, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "REVIEWER",  label: "Reviewer",    desc: "Reviews and approves extracted directives" },
  { value: "DEPT_USER", label: "Dept. User",   desc: "Views department action plans" },
  { value: "ADMIN",     label: "Admin",        desc: "Full system access and user management" },
];

const DEPARTMENTS = [
  "Labour Department",
  "Education Department",
  "Revenue Department",
  "Health Department",
  "Rural Development",
  "Urban Development",
  "Public Works Department",
  "Finance Department",
  "Home Department",
  "Agriculture Department",
  "Law Department",
  "General Administration",
];

export default function RegisterPage() {
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "REVIEWER",
    department: "",
    designation: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const passwordStrength = (): { label: string; color: string; pct: number } => {
    const p = form.password;
    if (!p) return { label: "", color: "", pct: 0 };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const map = [
      { label: "Weak",   color: "bg-red-500",   pct: 25 },
      { label: "Fair",   color: "bg-amber-400",  pct: 50 },
      { label: "Good",   color: "bg-blue-500",   pct: 75 },
      { label: "Strong", color: "bg-emerald-500", pct: 100 },
    ];
    return map[Math.max(score - 1, 0)];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        department: form.department || undefined,
        designation: form.designation.trim() || undefined,
      });
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrength();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 py-10 px-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-600 rounded-2xl p-3 mb-3">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">NyayaSetu</h1>
          <p className="text-slate-400 text-sm mt-1">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Register</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <Field label="Full Name" required>
              <input
                type="text"
                required
                value={form.name}
                onChange={set("name")}
                placeholder="e.g. Rajesh Kumar"
                className={inputCls}
              />
            </Field>

            {/* Email */}
            <Field label="Official Email" required>
              <input
                type="email"
                required
                value={form.email}
                onChange={set("email")}
                placeholder="officer@karnataka.gov.in"
                className={inputCls}
              />
            </Field>

            {/* Role */}
            <Field label="Role" required>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                      form.role === r.value
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {form.role === r.value && <CheckCircle className="w-3.5 h-3.5 text-blue-600" />}
                      <span className="text-sm font-medium text-slate-800">{r.label}</span>
                    </div>
                    <span className="text-xs text-slate-500 leading-tight">{r.desc}</span>
                  </button>
                ))}
              </div>
            </Field>

            {/* Department */}
            <Field label="Department">
              <select value={form.department} onChange={set("department")} className={inputCls}>
                <option value="">— Select department (optional) —</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>

            {/* Designation */}
            <Field label="Designation">
              <input
                type="text"
                value={form.designation}
                onChange={set("designation")}
                placeholder="e.g. Deputy Secretary, Section Officer"
                className={inputCls}
              />
            </Field>

            {/* Password */}
            <Field label="Password" required>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Min. 8 characters"
                  className={cn(inputCls, "pr-10")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-1.5 space-y-1">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", strength.color)}
                      style={{ width: `${strength.pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-500">{strength.label}</p>
                </div>
              )}
            </Field>

            {/* Confirm Password */}
            <Field label="Confirm Password" required>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                  placeholder="Re-enter password"
                  className={cn(
                    inputCls, "pr-10",
                    form.confirmPassword && form.password !== form.confirmPassword
                      ? "border-red-400 focus:ring-red-400"
                      : form.confirmPassword && form.password === form.confirmPassword
                      ? "border-emerald-400 focus:ring-emerald-400"
                      : ""
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </Field>

            <button
              type="submit"
              disabled={loading || (!!form.confirmPassword && form.password !== form.confirmPassword)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm mt-2"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="text-sm text-slate-500 mt-6 text-center">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>

          <p className="text-xs text-slate-400 mt-3 text-center">
            Secure government portal · All actions are audit-logged
          </p>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
