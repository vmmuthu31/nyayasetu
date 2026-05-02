"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Brain, LockKeyhole, User, Mail, Phone,
  Briefcase, Building2, MapPin, Lock, Eye, EyeOff,
  CheckCircle2, UserPlus, Shield, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

/* ─── Static data ────────────────────────────────────────────── */

const ALL_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  // Union Territories
  "Andaman & Nicobar Islands","Chandigarh","Dadra & Nagar Haveli and Daman & Diu",
  "Delhi (NCT)","Jammu & Kashmir","Ladakh","Lakshadweep","Puducherry",
];

const ALL_DEPARTMENTS = [
  "Agriculture Department","Animal Husbandry & Dairying","Civil Aviation",
  "Coal Ministry","Commerce & Industry","Consumer Affairs","Cooperation",
  "Culture Department","Defence Department","Disaster Management",
  "Education Department","Election Commission","Environment & Climate",
  "Finance Department","Fisheries Department","Food & Public Distribution",
  "Forest Department","General Administration","Health & Family Welfare",
  "Higher Education","Home Department","Horticulture Department",
  "Housing & Urban Affairs","Information & Broadcasting","Irrigation Department",
  "IT & Electronics","Jal Shakti / Water Resources","Labour & Employment",
  "Law Department","Micro, Small & Medium Enterprises","Mines Department",
  "New & Renewable Energy","Personnel & Training","Petroleum & Natural Gas",
  "Planning & Statistics","Ports, Shipping & Waterways","Power Department",
  "Public Works Department","Railways","Revenue Department",
  "Road Transport & Highways","Rural Development","Science & Technology",
  "Skill Development","Social Justice & Empowerment","Steel Department",
  "Textile Department","Tourism Department","Tribal Affairs",
  "Urban Development","Women & Child Development","Youth Affairs & Sports",
];

const ALL_DESIGNATIONS = [
  "Additional Collector","Additional Commissioner","Additional Director",
  "Additional Secretary","Assistant Collector","Assistant Commissioner",
  "Assistant Director","Block Development Officer (BDO)",
  "Chief Secretary","Chief Medical Officer (CMO)","Collector",
  "Commissioner","Deputy Collector","Deputy Commissioner",
  "Deputy Director","Deputy Secretary","Director",
  "District Development Officer","District Judge","District Magistrate",
  "Inspector General (IG)","Joint Collector","Joint Commissioner",
  "Joint Director","Joint Secretary","Judicial Magistrate",
  "Municipal Commissioner","Principal Secretary","Secretary",
  "Special Officer","Superintendent of Police (SP)","Tahsildar",
  "Under Secretary",
];

const ROLES = [
  {
    key: "REVIEWER",
    label: "Reviewer",
    desc: "Reviews and approves extracted directives",
    color: "indigo",
  },
  {
    key: "DEPT_USER",
    label: "Dept. User",
    desc: "Views department action plans",
    color: "violet",
  },
  {
    key: "ADMIN",
    label: "Admin",
    desc: "Full system access and user management",
    color: "amber",
  },
] as const;

type RoleKey = (typeof ROLES)[number]["key"];

/* ─── Password strength ──────────────────────────────────────── */

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { score, label: "Fair", color: "bg-orange-400" };
  if (score <= 4) return { score, label: "Good", color: "bg-amber-400" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [role, setRole] = useState<RoleKey>("REVIEWER");
  const [form, setForm] = useState({
    name: "", email: "", mobile: "", designation: "",
    department: "", officeUnit: "", state: "",
    password: "", confirmPassword: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const pwdRules = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    special: /[0-9!@#$%^&*]/.test(form.password),
  };
  const pwdStrength = passwordStrength(form.password);
  const pwdMatch = form.confirmPassword !== "" && form.password === form.confirmPassword;
  const pwdValid = Object.values(pwdRules).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdValid) { setError("Password does not meet all requirements."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (!agreeTerms) { setError("Please accept the Terms of Service to continue."); return; }

    setLoading(true);
    setError(null);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        role,
        mobile: form.mobile || undefined,
        designation: form.designation || undefined,
        department: form.department || undefined,
        office_unit: form.officeUnit || undefined,
        state: form.state || undefined,
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      setError((err as Error).message ?? "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[38%] bg-[#0B1120] text-white flex-col relative overflow-hidden border-r border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 to-transparent pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col flex-1 p-10 xl:p-14">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-14">
            <Image src="/logo.png" alt="NyayaSetu" width={44} height={44} className="rounded-xl shrink-0" />
            <div>
              <p className="text-white font-bold text-lg leading-tight">NyayaSetu</p>
              <p className="text-slate-500 text-[10px] uppercase tracking-widest leading-tight">
                AI-Powered Court Judgment Intelligence
              </p>
            </div>
          </div>

          {/* Hero */}
          <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-5">
            Smarter Insights.
            <br />
            <span className="text-indigo-400">Assured Compliance.</span>
          </h2>
          <p className="text-slate-400 text-base leading-relaxed mb-14 max-w-sm">
            NyayaSetu transforms complex court judgments into structured, verified action plans with an immutable audit trail.
          </p>

          {/* Features */}
          <div className="space-y-6">
            {[
              { icon: ShieldCheck, title: "100% Audit Ready", desc: "Tamper-evident SHA-256 hash chain for every action." },
              { icon: Brain, title: "AI + Human Verified", desc: "AI extracts, humans verify. Accuracy you can trust." },
              { icon: LockKeyhole, title: "Secure & Compliant", desc: "Government-grade security. No raw PII to external models." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-10 flex gap-6 text-xs text-slate-600">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Support</span>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top nav */}
        <div className="shrink-0 flex justify-end items-center px-8 py-5 border-b border-slate-100 bg-white/80 sticky top-0 z-10 backdrop-blur">
          <span className="text-sm text-slate-500 mr-3">Already have an account?</span>
          <Link
            href="/login"
            className="text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg border border-indigo-200 transition-colors"
          >
            Sign In
          </Link>
        </div>

        {/* Form */}
        <div className="flex-1 px-4 sm:px-8 py-8 w-full max-w-3xl mx-auto">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900">Create Your Account</h1>
            <p className="text-slate-500 text-sm mt-1">Join government officers across India simplifying compliance.</p>
          </div>

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">

            {/* ── ROLE SELECTION ── */}
            <Section title="Select Your Role">
              <div className="grid grid-cols-3 gap-3">
                {ROLES.map((r) => {
                  const selected = role === r.key;
                  const colorMap: Record<string, { ring: string; bg: string; text: string; check: string }> = {
                    indigo: { ring: "ring-indigo-500 border-indigo-400", bg: "bg-indigo-50", text: "text-indigo-700", check: "text-indigo-500" },
                    violet: { ring: "ring-violet-500 border-violet-400", bg: "bg-violet-50", text: "text-violet-700", check: "text-violet-500" },
                    amber:  { ring: "ring-amber-500 border-amber-400",   bg: "bg-amber-50",   text: "text-amber-700",  check: "text-amber-500"  },
                  };
                  const c = colorMap[r.color];
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRole(r.key)}
                      className={cn(
                        "relative text-left border-2 rounded-xl p-4 transition-all",
                        selected
                          ? cn("ring-2", c.ring, c.bg)
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      {selected && (
                        <CheckCircle2 className={cn("w-4 h-4 absolute top-3 right-3", c.check)} />
                      )}
                      <p className={cn("font-semibold text-sm mb-1", selected ? c.text : "text-slate-700")}>
                        {r.label}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-snug">{r.desc}</p>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* ── PERSONAL INFORMATION ── */}
            <Section title="Personal Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Full Name" required>
                  <IconInput icon={User}>
                    <input type="text" required value={form.name} onChange={set("name")}
                      placeholder="Enter your full name" className={input} />
                  </IconInput>
                </Field>

                <Field label="Official Email" required>
                  <IconInput icon={Mail}>
                    <input type="email" required value={form.email} onChange={set("email")}
                      placeholder="official@gov.in" className={input} />
                  </IconInput>
                </Field>

                <Field label="Mobile Number">
                  <div className="flex rounded-lg overflow-hidden border border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500">
                    <span className="flex items-center px-3 bg-slate-50 text-slate-500 text-sm border-r border-slate-300 shrink-0">
                      <Phone className="w-3.5 h-3.5 mr-1" />+91
                    </span>
                    <input type="tel" value={form.mobile} onChange={set("mobile")}
                      placeholder="10-digit mobile number"
                      className="flex-1 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-white" />
                  </div>
                </Field>

                <Field label="Designation" required>
                  <SelectInput icon={Briefcase}>
                    <select required value={form.designation} onChange={set("designation")} className={select}>
                      <option value="" disabled>Select designation</option>
                      {ALL_DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </SelectInput>
                </Field>
              </div>
            </Section>

            {/* ── ORGANISATION ── */}
            <Section title="Organisation">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="State / UT" required>
                  <SelectInput icon={MapPin}>
                    <select required value={form.state} onChange={set("state")} className={select}>
                      <option value="" disabled>Select State / UT</option>
                      {ALL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </SelectInput>
                </Field>

                <Field label="Department / Organisation" required>
                  <SelectInput icon={Building2}>
                    <select required value={form.department} onChange={set("department")} className={select}>
                      <option value="" disabled>Select department</option>
                      {ALL_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </SelectInput>
                </Field>

                <Field label="Office / Unit / Division" className="md:col-span-2">
                  <IconInput icon={Building2}>
                    <input type="text" value={form.officeUnit} onChange={set("officeUnit")}
                      placeholder="e.g. District Collectorate, Divisional Office"
                      className={input} />
                  </IconInput>
                </Field>
              </div>
            </Section>

            {/* ── ACCOUNT SECURITY ── */}
            <Section title="Account Security">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <Field label="Password" required>
                  <IconInput icon={Lock} right={
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="text-slate-400 hover:text-slate-600">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }>
                    <input type={showPwd ? "text" : "password"} required
                      value={form.password} onChange={set("password")}
                      placeholder="Create a strong password" className={input} />
                  </IconInput>
                  {form.password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex h-1.5 gap-1">
                        {[1,2,3,4].map((i) => (
                          <div key={i} className={cn(
                            "flex-1 rounded-full transition-colors",
                            pwdStrength.score >= i * 1.5 ? pwdStrength.color : "bg-slate-200"
                          )} />
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Strength: <span className={cn("font-semibold",
                          pwdStrength.label === "Weak" ? "text-red-500" :
                          pwdStrength.label === "Fair" ? "text-orange-500" :
                          pwdStrength.label === "Good" ? "text-amber-500" : "text-emerald-600"
                        )}>{pwdStrength.label}</span>
                      </p>
                    </div>
                  )}
                </Field>

                <Field label="Confirm Password" required>
                  <IconInput icon={Lock} right={
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="text-slate-400 hover:text-slate-600">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }>
                    <input type={showConfirm ? "text" : "password"} required
                      value={form.confirmPassword} onChange={set("confirmPassword")}
                      placeholder="Repeat your password"
                      className={cn(input,
                        form.confirmPassword
                          ? pwdMatch ? "border-emerald-400 focus:border-emerald-500" : "border-red-400 focus:border-red-500"
                          : ""
                      )} />
                  </IconInput>
                  {form.confirmPassword && (
                    <p className={cn("text-[11px] mt-1.5", pwdMatch ? "text-emerald-600" : "text-red-500")}>
                      {pwdMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                    </p>
                  )}
                </Field>
              </div>

              {/* Password rules */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-2">
                {[
                  { ok: pwdRules.length, text: "8+ characters" },
                  { ok: pwdRules.upper,  text: "Uppercase letter" },
                  { ok: pwdRules.lower,  text: "Lowercase letter" },
                  { ok: pwdRules.special,text: "Number or symbol" },
                ].map(({ ok, text }) => (
                  <div key={text} className="flex items-center gap-1.5">
                    <CheckCircle2 className={cn("w-3.5 h-3.5", ok ? "text-emerald-500" : "text-slate-300")} />
                    <span className={cn("text-xs", ok ? "text-slate-700" : "text-slate-400")}>{text}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* ── TERMS ── */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-sm text-slate-600 leading-relaxed">
                I agree to the{" "}
                <Link href="#" className="text-indigo-600 hover:underline">Terms of Service</Link>
                {" "}and{" "}
                <Link href="#" className="text-indigo-600 hover:underline">Privacy Policy</Link>.
                All actions on this platform are audit-logged as per government policy.
              </span>
            </label>

            {/* ── SUBMIT ── */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all text-sm shadow flex items-center justify-center gap-2"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account…</>
                : <><UserPlus className="w-4 h-4" /> Create Account</>
              }
            </button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 pb-4">
              <LockKeyhole className="w-3.5 h-3.5" />
              Your data is encrypted. No raw PII is sent to external services. All actions are audit-logged.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────── */

const input =
  "w-full text-sm border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white";

const select =
  "w-full text-sm border border-slate-300 rounded-lg pl-10 pr-9 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none bg-white";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4 pb-2 border-b border-slate-200">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, required, children, className }: {
  label: string; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-sm font-medium text-slate-700">
        {label}{required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function IconInput({ icon: Icon, children, right }: {
  icon: React.ElementType; children: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
      {children}
      {right && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

function SelectInput({ icon: Icon, children }: {
  icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
      {children}
    </div>
  );
}
