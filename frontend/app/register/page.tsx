"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck, Brain, LockKeyhole,
  User, Mail, Phone, Briefcase, Building2, Lock,
  Eye, EyeOff, CheckCircle2, UserPlus, Shield,
  Users, LayoutDashboard, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

/* ─── Constants ─────────────────────────────────────────── */

const ROLES = [
  {
    value: "REVIEWER",
    label: "Reviewer",
    desc: "Reviews and approves extracted directives",
    icon: <ShieldCheck className="w-5 h-5" />,
    color: "indigo",
  },
  {
    value: "DEPT_USER",
    label: "Dept. User",
    desc: "Views department action plans",
    icon: <LayoutDashboard className="w-5 h-5" />,
    color: "violet",
  },
  {
    value: "ADMIN",
    label: "Admin",
    desc: "Full system access and user management",
    icon: <Crown className="w-5 h-5" />,
    color: "amber",
  },
];

const DEPARTMENTS = [
  "Labour Department", "Education Department", "Revenue Department",
  "Health Department", "Rural Development", "Urban Development",
  "Public Works Department", "Finance Department", "Home Department",
  "Agriculture Department", "Law Department", "General Administration",
];

/* ─── Helpers ────────────────────────────────────────────── */

const roleColorMap: Record<string, { border: string; bg: string; text: string; icon: string }> = {
  indigo: {
    border: "border-indigo-500",
    bg:     "bg-indigo-50",
    text:   "text-indigo-700",
    icon:   "text-indigo-500",
  },
  violet: {
    border: "border-violet-500",
    bg:     "bg-violet-50",
    text:   "text-violet-700",
    icon:   "text-violet-500",
  },
  amber: {
    border: "border-amber-500",
    bg:     "bg-amber-50",
    text:   "text-amber-700",
    icon:   "text-amber-500",
  },
};

function passwordStrength(p: string): { label: string; color: string; pct: number } {
  if (!p) return { label: "", color: "", pct: 0 };
  let score = 0;
  if (p.length >= 8)           score++;
  if (/[A-Z]/.test(p))         score++;
  if (/[0-9]/.test(p))         score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  const map = [
    { label: "Weak",   color: "bg-red-500",    pct: 25  },
    { label: "Fair",   color: "bg-amber-400",  pct: 50  },
    { label: "Good",   color: "bg-blue-500",   pct: 75  },
    { label: "Strong", color: "bg-emerald-500", pct: 100 },
  ];
  return map[Math.max(score - 1, 0)];
}

/* ─── Page ───────────────────────────────────────────────── */

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: "", email: "", mobile: "",
    designation: "", department: "", officeUnit: "",
    role: "REVIEWER",
    password: "", confirmPassword: "",
    agreeTerms: false,
  });
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm,  setShowConfirm]    = useState(false);
  const [error,        setError]          = useState<string | null>(null);
  const [loading,      setLoading]        = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        e.target.type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : e.target.value;
      setForm((f) => ({ ...f, [k]: value }));
    };

  const pwdRules = {
    length:  form.password.length >= 8,
    upper:   /[A-Z]/.test(form.password),
    lower:   /[a-z]/.test(form.password),
    special: /[0-9!@#$%^&*]/.test(form.password),
  };
  const strength = passwordStrength(form.password);
  const pwdMatch = form.confirmPassword
    ? form.password === form.confirmPassword
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register({
        name:        form.name,
        email:       form.email,
        password:    form.password,
        role:        form.role,
        department:  form.department || undefined,
        designation: form.designation || undefined,
        mobile:      form.mobile || undefined,
        office_unit: form.officeUnit || undefined,
      });
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans">

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-[42%] bg-[#0B1120] text-white p-12 flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 to-transparent pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex-1 flex flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-14">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">NyayaSetu</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                AI-Powered Judgment Intelligence
              </p>
            </div>
          </div>

          {/* Hero */}
          <h2 className="text-4xl font-bold leading-tight mb-5">
            Smarter Insights.
            <br />
            <span className="text-indigo-400">Assured Compliance.</span>
          </h2>
          <p className="text-slate-300 text-base leading-relaxed max-w-sm mb-14">
            NyayaSetu transforms complex court judgments into structured,
            verified action plans — with an immutable audit trail.
          </p>

          {/* Features */}
          <div className="space-y-7">
            <Feature
              icon={<ShieldCheck className="text-indigo-400 w-5 h-5" />}
              title="100% Audit Ready"
              desc="Tamper-evident logs for every action taken."
            />
            <Feature
              icon={<Brain className="text-indigo-400 w-5 h-5" />}
              title="AI + Human Verified"
              desc="AI extracts, humans verify. Accuracy you can trust."
            />
            <Feature
              icon={<LockKeyhole className="text-indigo-400 w-5 h-5" />}
              title="Secure by Design"
              desc="No raw PII sent externally. Government-grade security."
            />
          </div>

          {/* Stats row */}
          <div className="mt-auto flex gap-6 pt-14">
            {[["3 Roles", "RBAC access control"], ["SHA-256", "Audit hash chain"], ["Groq AI", "Free-tier LLM"]].map(
              ([val, lbl]) => (
                <div key={val} className="text-center">
                  <div className="text-lg font-bold text-white">{val}</div>
                  <div className="text-xs text-slate-500">{lbl}</div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM AREA ── */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top bar */}
        <div className="flex justify-end items-center px-8 py-5 shrink-0">
          <span className="text-sm text-slate-500 mr-3">Already have an account?</span>
          <Link
            href="/login"
            className="text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>

        {/* Form card */}
        <div className="flex-1 px-4 sm:px-10 pb-16 w-full max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 xl:p-10">
            {/* Header */}
            <div className="flex items-center gap-4 mb-10">
              <div className="w-11 h-11 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Create Your Account</h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  Join the Karnataka High Court compliance network.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-9">

              {/* ── SECTION: Role ── */}
              <div>
                <SectionHeading title="Select Your Role" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  {ROLES.map((r) => {
                    const selected = form.role === r.value;
                    const c = roleColorMap[r.color];
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                        className={cn(
                          "relative text-left p-4 rounded-xl border-2 transition-all duration-150 cursor-pointer",
                          selected
                            ? `${c.border} ${c.bg} shadow-sm`
                            : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50"
                        )}
                      >
                        {selected && (
                          <CheckCircle2
                            className={cn("absolute top-3 right-3 w-4 h-4", c.icon)}
                          />
                        )}
                        <div className={cn("mb-2", selected ? c.icon : "text-slate-400")}>
                          {r.icon}
                        </div>
                        <div
                          className={cn(
                            "font-semibold text-sm",
                            selected ? c.text : "text-slate-700"
                          )}
                        >
                          {r.label}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-snug">
                          {r.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── SECTION: Personal Info ── */}
              <div>
                <SectionHeading title="Personal Information" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                  <InputGroup label="Full Name" required>
                    <FieldWrap icon={<User className="w-4 h-4" />}>
                      <input
                        type="text" required value={form.name} onChange={set("name")}
                        placeholder="Enter your full name"
                        className={inputCls}
                      />
                    </FieldWrap>
                  </InputGroup>

                  <InputGroup label="Official Email" required>
                    <FieldWrap icon={<Mail className="w-4 h-4" />}>
                      <input
                        type="email" required value={form.email} onChange={set("email")}
                        placeholder="officer@karnataka.gov.in"
                        className={inputCls}
                      />
                    </FieldWrap>
                  </InputGroup>

                  <InputGroup label="Mobile Number">
                    <div className="flex rounded-lg shadow-sm">
                      <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">
                        +91
                      </span>
                      <FieldWrap icon={<Phone className="w-4 h-4" />} className="flex-1">
                        <input
                          type="tel" value={form.mobile} onChange={set("mobile")}
                          placeholder="Enter mobile number"
                          className={cn(inputCls, "rounded-l-none")}
                        />
                      </FieldWrap>
                    </div>
                  </InputGroup>

                  <InputGroup label="Designation" required>
                    <FieldWrap icon={<Briefcase className="w-4 h-4" />}>
                      <input
                        type="text" required value={form.designation} onChange={set("designation")}
                        placeholder="e.g. Deputy Secretary"
                        className={inputCls}
                      />
                    </FieldWrap>
                  </InputGroup>
                </div>
              </div>

              {/* ── SECTION: Org Info ── */}
              <div>
                <SectionHeading title="Organisation" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                  <InputGroup label="Department" required>
                    <FieldWrap icon={<Building2 className="w-4 h-4" />}>
                      <select
                        required value={form.department} onChange={set("department")}
                        className={cn(inputCls, "appearance-none bg-white")}
                      >
                        <option value="" disabled>Select department</option>
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </FieldWrap>
                  </InputGroup>

                  <InputGroup label="Office / Unit">
                    <FieldWrap icon={<Users className="w-4 h-4" />}>
                      <input
                        type="text" value={form.officeUnit} onChange={set("officeUnit")}
                        placeholder="Division or unit name"
                        className={inputCls}
                      />
                    </FieldWrap>
                  </InputGroup>
                </div>
              </div>

              {/* ── SECTION: Security ── */}
              <div>
                <SectionHeading title="Account Security" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                  {/* Password */}
                  <div className="flex flex-col">
                    <InputGroup label="Password" required>
                      <FieldWrap icon={<Lock className="w-4 h-4" />}>
                        <input
                          type={showPassword ? "text" : "password"}
                          required value={form.password} onChange={set("password")}
                          placeholder="Create a strong password"
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </FieldWrap>
                    </InputGroup>

                    {/* Strength bar */}
                    {form.password && (
                      <div className="mt-2 space-y-1">
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-300", strength.color)}
                            style={{ width: `${strength.pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500">
                          Strength:{" "}
                          <span
                            className={cn(
                              "font-medium",
                              strength.pct <= 25 ? "text-red-600" :
                              strength.pct <= 50 ? "text-amber-600" :
                              strength.pct <= 75 ? "text-blue-600" : "text-emerald-600"
                            )}
                          >
                            {strength.label}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <InputGroup label="Confirm Password" required>
                    <FieldWrap icon={<Lock className="w-4 h-4" />}>
                      <input
                        type={showConfirm ? "text" : "password"}
                        required value={form.confirmPassword} onChange={set("confirmPassword")}
                        placeholder="Repeat your password"
                        className={cn(
                          inputCls,
                          pwdMatch === false && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
                          pwdMatch === true  && "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </FieldWrap>
                    {pwdMatch === false && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                    {pwdMatch === true && (
                      <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Passwords match
                      </p>
                    )}
                  </InputGroup>
                </div>

                {/* Password rules */}
                <div className="mt-4 bg-indigo-50/60 border border-indigo-100 rounded-lg p-4 flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-indigo-700 whitespace-nowrap">
                    <Shield className="w-3.5 h-3.5" /> Password must have:
                  </div>
                  <Rule checked={pwdRules.length}  text="8+ characters" />
                  <Rule checked={pwdRules.upper}   text="Uppercase letter" />
                  <Rule checked={pwdRules.lower}   text="Lowercase letter" />
                  <Rule checked={pwdRules.special} text="Number or symbol" />
                </div>
              </div>

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                  <input
                    type="checkbox" required
                    checked={form.agreeTerms}
                    onChange={set("agreeTerms")}
                    className="peer w-4 h-4 appearance-none border border-slate-300 rounded cursor-pointer checked:bg-indigo-600 checked:border-indigo-600 transition-all"
                  />
                  <CheckCircle2 className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none" />
                </div>
                <span className="text-sm text-slate-600 select-none group-hover:text-slate-800">
                  I agree to the{" "}
                  <Link href="#" className="text-indigo-600 hover:underline font-medium">Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="#" className="text-indigo-600 hover:underline font-medium">Privacy Policy</Link>.
                  All actions on this platform are audit-logged as required by government policy.
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all text-sm shadow-sm flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {loading ? "Creating Account…" : "Create Account"}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 pb-2">
                <LockKeyhole className="w-3.5 h-3.5" />
                Your data is encrypted. No raw PII is sent to external services.
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

const inputCls =
  "w-full text-sm border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all shadow-sm";

function SectionHeading({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
      {title}
    </h3>
  );
}

function InputGroup({
  label, required, children,
}: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function FieldWrap({
  icon, children, className,
}: {
  icon: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        {icon}
      </span>
      {children}
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="font-semibold text-white text-sm mb-0.5">{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Rule({ checked, text }: { checked: boolean; text: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <CheckCircle2
        className={cn("w-3.5 h-3.5 shrink-0", checked ? "text-emerald-500" : "text-slate-300")}
      />
      <span className={cn(checked ? "text-slate-700" : "text-slate-500")}>{text}</span>
    </div>
  );
}
