"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Scale,
  ShieldCheck,
  Brain,
  LockKeyhole,
  User,
  Mail,
  Phone,
  Briefcase,
  Building2,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  UserPlus,
  Shield,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const STATES = [
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Kerala",
  "Delhi",
  "Telangana",
];

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    designation: "",
    department: "",
    officeUnit: "",
    state: "",
    password: "",
    confirmPassword: "",
    captcha: "",
    agreeTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        e.target.type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : e.target.value;
      setForm((f) => ({ ...f, [k]: value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Your submission logic here
    console.log("Submitting:", form);
  };

  // Password validation rules
  const pwdRules = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    special: /[0-9!@#$%^&*]/.test(form.password),
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans">
      {/* LEFT SIDEBAR - Branding & Value Prop */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] bg-[#0B1120] text-white p-10 xl:p-14 flex-col relative overflow-hidden border-r border-slate-800">
        {/* Subtle background glow effect */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#1e1b4b]/40 to-transparent pointer-events-none" />

        <div className="relative z-10 flex-1">
          {/* Logo Area */}
          <div className="flex items-center gap-3 mb-12">
            <img src="/logo.png" alt="NyayaSetu Logo" className="w-auto h-20" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">NyayaSetu</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                AI-Powered Court Judgment
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                Intelligence & Verified Action Engine
              </p>
            </div>
          </div>

          {/* Hero Copy */}
          <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
            Smarter Insights.
            <br />
            <span className="text-indigo-400">Assured Compliance.</span>
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed max-w-md mb-16">
            NyayaSetu transforms complex court judgments into structured,
            verified action plans with an immutable audit trail.
          </p>

          {/* Feature List */}
          <div className="space-y-8">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Why NyayaSetu?
            </h3>

            <Feature
              icon={<ShieldCheck className="text-indigo-400 w-6 h-6" />}
              title="100% Audit Ready"
              desc="Immutable audit trail for every action with tamper-evident logs."
            />
            <Feature
              icon={<Brain className="text-indigo-400 w-6 h-6" />}
              title="AI + Human Verified"
              desc="AI extracts, humans verify. Accuracy you can trust."
            />
            <Feature
              icon={<LockKeyhole className="text-indigo-400 w-6 h-6" />}
              title="Secure & Compliant"
              desc="No raw PII sent to external models. Built for government-grade security."
            />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Form Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Navbar */}
        <div className="w-full flex justify-end items-center px-8 py-6">
          <span className="text-sm text-slate-600 mr-4">
            Already have an account?
          </span>
          <Link
            href="/login"
            className="text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-5 py-2 rounded-lg border border-indigo-200 transition-colors"
          >
            Sign In
          </Link>
        </div>

        {/* Form Container */}
        <div className="flex-1 px-4 sm:px-8 pb-12 w-full max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 xl:p-10">
            {/* Form Header */}
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                <User className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Create Your NyayaSetu Account
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Join thousands of government officers simplifying compliance.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* SECTION 1: Personal Info */}
              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-4 border-b pb-2">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InputGroup label="Full Name" required>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={set("name")}
                        placeholder="Enter your full name"
                        className={inputClasses}
                      />
                    </div>
                  </InputGroup>

                  <InputGroup label="Email Address" required>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={set("email")}
                        placeholder="Enter your official email"
                        className={inputClasses}
                      />
                    </div>
                  </InputGroup>

                  <InputGroup label="Mobile Number" required>
                    <div className="flex rounded-lg shadow-sm">
                      <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-slate-500 sm:text-sm">
                        +91
                      </span>
                      <div className="relative flex-1">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="tel"
                          required
                          value={form.mobile}
                          onChange={set("mobile")}
                          placeholder="Enter mobile number"
                          className={cn(inputClasses, "rounded-l-none pl-10")}
                        />
                      </div>
                    </div>
                  </InputGroup>

                  <InputGroup label="Designation" required>
                    <div className="relative">
                      <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={form.designation}
                        onChange={set("designation")}
                        placeholder="Enter your designation"
                        className={inputClasses}
                      />
                    </div>
                  </InputGroup>
                </div>
              </div>

              {/* SECTION 2: Org Info */}
              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-4 border-b pb-2">
                  Organization Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <InputGroup label="Department / Organization" required>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        required
                        value={form.department}
                        onChange={set("department")}
                        className={cn(inputClasses, "appearance-none bg-white")}
                      >
                        <option value="" disabled>
                          Select your department
                        </option>
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </InputGroup>

                  <InputGroup label="Office / Unit">
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={form.officeUnit}
                        onChange={set("officeUnit")}
                        placeholder="Enter office or unit name"
                        className={inputClasses}
                      />
                    </div>
                  </InputGroup>
                </div>

                <InputGroup label="State" required>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      required
                      value={form.state}
                      onChange={set("state")}
                      className={cn(inputClasses, "appearance-none bg-white")}
                    >
                      <option value="" disabled>
                        Select State
                      </option>
                      {STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </InputGroup>
              </div>

              {/* SECTION 3: Security */}
              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-4 border-b pb-2">
                  Account Security
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                  <InputGroup label="Password" required>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={form.password}
                        onChange={set("password")}
                        placeholder="Create a strong password"
                        className={inputClasses}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </InputGroup>

                  <InputGroup label="Confirm Password" required>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showConfirm ? "text" : "password"}
                        required
                        value={form.confirmPassword}
                        onChange={set("confirmPassword")}
                        placeholder="Confirm your password"
                        className={inputClasses}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirm ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </InputGroup>
                </div>

                {/* Password Rules Box */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex items-center gap-2 text-indigo-700 font-medium text-sm whitespace-nowrap">
                    <Shield className="w-4 h-4" /> Password must contain:
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <Rule
                      checked={pwdRules.length}
                      text="At least 8 characters"
                    />
                    <Rule
                      checked={pwdRules.upper}
                      text="One uppercase letter"
                    />
                    <Rule
                      checked={pwdRules.lower}
                      text="One lowercase letter"
                    />
                    <Rule
                      checked={pwdRules.special}
                      text="One number/special character"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: Verification & Submit */}
              <div className="pt-2">
                <InputGroup label="Verification">
                  <div className="flex items-center gap-4 mt-1">
                    {/* Fake Captcha Graphic */}
                    <div className="relative bg-slate-200 w-40 h-11 rounded flex items-center justify-center overflow-hidden border border-slate-300">
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage:
                            "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiPjwvcmVjdD48cGF0aCBkPSJNMCAwTDIgMloiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxeHB4Ij48L3BhdGg+PC9zdmc+')",
                        }}
                      ></div>
                      <span className="font-mono text-xl font-bold tracking-[0.3em] text-slate-700 z-10 select-none">
                        7K3LQ9
                      </span>
                    </div>
                    <button
                      type="button"
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <input
                      type="text"
                      value={form.captcha}
                      onChange={set("captcha")}
                      placeholder="Enter the code shown"
                      className={cn(inputClasses, "max-w-[200px] pl-4")}
                    />
                  </div>
                </InputGroup>
              </div>

              {/* Terms Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer mt-4 group">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    required
                    checked={form.agreeTerms}
                    onChange={set("agreeTerms")}
                    className="peer w-4 h-4 appearance-none border border-slate-300 rounded cursor-pointer checked:bg-indigo-600 checked:border-indigo-600 transition-all"
                  />
                  <CheckCircle2 className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none" />
                </div>
                <span className="text-sm text-slate-600 select-none group-hover:text-slate-800">
                  I agree to the{" "}
                  <Link href="#" className="text-indigo-600 hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="#" className="text-indigo-600 hover:underline">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-[#4338ca] hover:bg-[#3730a3] text-white font-medium py-3.5 rounded-xl transition-all duration-200 text-sm shadow-sm flex items-center justify-center gap-2 mt-6"
              >
                <UserPlus className="w-5 h-5" />
                Create Account
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-6 pb-4">
                <LockKeyhole className="w-3.5 h-3.5" />
                <span>
                  Your data is encrypted and secure. We respect your privacy.
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents

const inputClasses =
  "w-full text-sm border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all shadow-sm";

function InputGroup({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="font-semibold text-white mb-1">{title}</h4>
        <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Rule({ checked, text }: { checked: boolean; text: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <CheckCircle2
        className={cn(
          "w-3.5 h-3.5",
          checked ? "text-emerald-500" : "text-slate-300",
        )}
      />
      <span className={cn(checked ? "text-slate-700" : "text-slate-500")}>
        {text}
      </span>
    </div>
  );
}
