"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, FileText, MessageSquarePlus, UploadCloud } from "lucide-react";
import { ActionPlan, api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";

export default function ActionPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadPlan(id: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.actionPlans.get(id);
      setPlan(data);
      setRemarks(data.remarks ?? "");
      setCompletionNotes(data.completion_notes ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!params.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPlan(params.id);
  }, [params.id]);

  async function updateStatus(status: "IN_PROGRESS" | "ESCALATED") {
    if (!plan) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.actionPlans.updateStatus(plan.id, status, completionNotes || undefined);
      setPlan(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submitRemarks() {
    if (!plan || !remarks.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.actionPlans.addRemarks(plan.id, remarks.trim());
      setPlan(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submitCompletion() {
    if (!plan) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.actionPlans.submit(plan.id, completionNotes || undefined);
      setPlan(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onUploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !plan) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.actionPlans.uploadAffidavit(plan.id, file, completionNotes || undefined);
      setPlan(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  }

  if (loading) {
    return (
      <main className="flex h-full items-center justify-center bg-white text-sm text-slate-500">
        Loading action plan details
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="flex h-full items-center justify-center bg-white text-sm text-slate-500">
        Action plan not found
      </main>
    );
  }

  const departmentCanEdit = can(user, "update_compliance");

  return (
    <main className="h-full overflow-y-auto bg-[#f8fafc]">
      <div className="mx-auto flex min-h-full w-full max-w-[1280px] flex-col px-8 py-8">
        <header className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Action Plan Detail</p>
            <h1 className="mt-3 text-[30px] font-semibold text-slate-950">{plan.case_number}</h1>
            <p className="mt-2 text-sm text-slate-500">{plan.court}</p>
          </div>
          <div className={cn("inline-flex rounded-full px-4 py-2 text-sm font-semibold", riskTone(plan))}>
            {riskLabel(plan)}
          </div>
        </header>

        {error ? (
          <div className="mt-5 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.95fr_1.1fr]">
          <Panel title="Court Directive" subtitle="Source instruction for the assigned department">
            <p className="text-[15px] leading-7 text-slate-700">{plan.directive_text}</p>
            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
              Responsible Department: <span className="font-semibold text-slate-700">{plan.assigned_department}</span>
            </div>
          </Panel>

          <Panel title="Extracted Metadata" subtitle="Structured fields used by the workflow engine">
            <MetadataRow label="Court" value={plan.court} />
            <MetadataRow label="Case Number" value={plan.case_number} />
            <MetadataRow label="Deadline" value={formatLongDate(plan.due_date)} />
            <MetadataRow label="Assigned Officer" value={plan.assigned_officer_name ?? "Department Officer"} />
            <MetadataRow label="Verification Status" value={humanizeStatus(plan.status)} />
            <MetadataRow label="Action Type" value={plan.action_type} />
          </Panel>

          <Panel title="Compliance Workflow" subtitle="Operational actions available for this plan">
            <div className="grid gap-3">
              <label className={buttonClass(departmentCanEdit)} aria-disabled={!departmentCanEdit}>
                <UploadCloud className="h-4 w-4" />
                Upload Affidavit
                <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={(event) => void onUploadFile(event)} className="hidden" disabled={!departmentCanEdit || saving} />
              </label>
              <button type="button" disabled={!departmentCanEdit || saving} onClick={() => void updateStatus("IN_PROGRESS")} className={buttonClass(departmentCanEdit)}>
                <Clock3 className="h-4 w-4" />
                Mark In Progress
              </button>
              <button type="button" disabled={!departmentCanEdit || saving} onClick={() => void submitCompletion()} className={buttonClass(departmentCanEdit, true)}>
                <CheckCircle2 className="h-4 w-4" />
                Mark Completed
              </button>
              <button type="button" disabled={!departmentCanEdit || saving} onClick={() => void updateStatus("ESCALATED")} className={buttonClass(departmentCanEdit)}>
                <AlertTriangle className="h-4 w-4" />
                Escalate
              </button>
              <button type="button" disabled={!departmentCanEdit || saving} onClick={() => void submitRemarks()} className={buttonClass(departmentCanEdit)}>
                <MessageSquarePlus className="h-4 w-4" />
                Add Remarks
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Completion Notes
                <textarea
                  value={completionNotes}
                  onChange={(event) => setCompletionNotes(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-300"
                  placeholder="Summarize current progress, affidavit status, or reviewer-ready notes."
                  disabled={!departmentCanEdit}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Remarks
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-300"
                  placeholder="Add operational remarks for reviewers or administrators."
                  disabled={!departmentCanEdit}
                />
              </label>
            </div>
          </Panel>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Timeline / Activity Feed" subtitle="End-to-end trace of compliance updates">
            <div className="space-y-4">
              {plan.timeline.length === 0 ? (
                <p className="text-sm text-slate-400">No timeline events yet.</p>
              ) : (
                plan.timeline.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">{item.message}</p>
                      <span className="text-xs font-medium text-slate-400">{formatLongDateTime(item.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {item.actor_label} · {item.event_type.replaceAll("_", " ")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Attached Documents" subtitle="Working files for the compliance packet">
            <div className="space-y-3">
              <DocumentRow label="Compliance affidavit" href={plan.affidavit_url} />
              <DocumentRow label="Department notes" href={null} />
              <DocumentRow label="Uploaded PDF" href={plan.affidavit_url} />
              <DocumentRow label="Court order copy" href={`/cases/${plan.case_id}/review`} internal />
            </div>
            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
              Reviewer Access: reviewers can reopen incomplete action plans and verify submitted actions. Admins can reassign and override workflow state.
            </div>
          </Panel>
        </section>

        <div className="mt-6">
          <Link href="/department/action-plans" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            ← Back to Department Action Plans
          </Link>
        </div>
      </div>
    </main>
  );
}

function Panel({ children, subtitle, title }: { children: React.ReactNode; subtitle: string; title: string }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
      <h2 className="text-[20px] font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-slate-100 py-3 text-sm last:border-b-0">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function DocumentRow({ href, internal, label }: { href: string | null; internal?: boolean; label: string }) {
  if (!href) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
        <FileText className="h-4 w-4" />
        {label}
      </div>
    );
  }

  const content = (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
      <FileText className="h-4 w-4 text-indigo-500" />
      {label}
    </div>
  );

  return internal ? <Link href={href}>{content}</Link> : <a href={href} target="_blank" rel="noreferrer">{content}</a>;
}

function humanizeStatus(status: ActionPlan["status"]) {
  return status.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function riskLabel(plan: ActionPlan) {
  if (!plan.due_date) return "On Track";
  const daysRemaining = Math.ceil((new Date(plan.due_date).getTime() - Date.now()) / 86400000);
  if (plan.status === "ESCALATED" || plan.status === "OVERDUE" || daysRemaining < 0) return `Overdue by ${Math.abs(daysRemaining)} days`;
  if (daysRemaining <= 5) return `Due in ${daysRemaining} days`;
  return "On Track";
}

function riskTone(plan: ActionPlan) {
  if (!plan.due_date) return "bg-emerald-50 text-emerald-700";
  const daysRemaining = Math.ceil((new Date(plan.due_date).getTime() - Date.now()) / 86400000);
  if (plan.status === "ESCALATED" || plan.status === "OVERDUE" || daysRemaining < 0) return "bg-rose-50 text-rose-700";
  if (daysRemaining <= 5) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function buttonClass(enabled: boolean, primary?: boolean) {
  return cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
    primary ? "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    !enabled && "cursor-not-allowed opacity-50",
  );
}

function formatLongDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatLongDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
