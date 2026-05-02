"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Eye, EyeOff, LogIn,
  ShieldCheck, Brain, LockKeyhole, Lock, Mail,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { login } = useAuth();
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen font-sans">

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] bg-[#0B1120] text-white flex-col relative overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-transparent to-violet-900/20 pointer-events-none" />
        <div className="absolute top-1/3 -left-24 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col h-full p-12 xl:p-16">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto pb-16">
            <Image src="/logo.png" alt="NyayaSetu" width={44} height={44} className="rounded-xl" />
            <div>
              <h1 className="text-lg font-bold">NyayaSetu</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                AI-Powered Judgment Intelligence
              </p>
            </div>
          </div>

          {/* Hero */}
          <div className="mb-auto">
            <h2 className="text-5xl xl:text-6xl font-bold leading-[1.1] mb-6">
              Court Judgments
              <br />
              <span className="text-indigo-400">→ Verified</span>
              <br />
              <span className="text-indigo-400">Action Plans.</span>
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed max-w-md mb-14">
              NyayaSetu serves every High Court jurisdiction across India —
              extracting directives, routing them to the right department, and
              building an immutable compliance trail automatically.
            </p>

            {/* Features */}
            <div className="space-y-6">
              <Feature
                icon={<ShieldCheck className="text-indigo-400 w-5 h-5" />}
                title="Tamper-Evident Audit Trail"
                desc="Every action hashed in an immutable SHA-256 chain."
              />
              <Feature
                icon={<Brain className="text-indigo-400 w-5 h-5" />}
                title="AI Extraction + Human Review"
                desc="LLM extracts, humans approve. Zero hallucination policy."
              />
              <Feature
                icon={<LockKeyhole className="text-indigo-400 w-5 h-5" />}
                title="Government-Grade Security"
                desc="RBAC roles, encrypted tokens, no PII to third parties."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-auto pt-12 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              Indian High Court Case Management System · NyayaSetu v1.0
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM AREA ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f8fafc] px-6 py-12">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <Image src="/logo.png" alt="NyayaSetu" width={36} height={36} className="rounded-xl" />
          <span className="text-lg font-bold text-slate-900">NyayaSetu</span>
        </div>

        <div className="w-full max-w-[420px]">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 xl:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
              <p className="text-slate-500 text-sm mt-1">
                Sign in to your NyayaSetu account
              </p>
            </div>

            {error && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email" required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer@karnataka.gov.in"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-slate-700">Password</label>
                  <Link href="#" className="text-xs text-indigo-600 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={cn(inputCls, "pr-11")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all text-sm shadow-sm flex items-center justify-center gap-2 mt-2"
              >
                <LogIn className="w-4 h-4" />
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <p className="text-sm text-slate-500 mt-6 text-center">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-semibold text-indigo-600 hover:underline">
                Create account
              </Link>
            </p>
          </div>

          <p className="text-xs text-slate-400 text-center mt-5 flex items-center justify-center gap-1.5">
            <LockKeyhole className="w-3 h-3" />
            Secure government portal · All actions are audit-logged
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────── */

const inputCls =
  "w-full text-sm border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all shadow-sm";

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-9 h-9 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="font-semibold text-white text-sm mb-0.5">{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
