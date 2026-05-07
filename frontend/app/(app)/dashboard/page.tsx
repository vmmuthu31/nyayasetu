"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Menu,
  Moon,
  SunMedium,
} from "lucide-react";
import { ActionPlan, api, CaseDetail, CaseListItem, StatsResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn, formatDate } from "@/lib/utils";

type DashboardSeed = {
  caseItem: CaseListItem | null;
  caseDetail: CaseDetail | null;
  actionPlans: ActionPlan[];
};

const TAB_OPTIONS = ["PDF Viewer", "Extracted Text", "Directive Blocks"] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [seed, setSeed] = useState<DashboardSeed>({
    caseItem: null,
    caseDetail: null,
    actionPlans: [],
  });
  const [activeTab, setActiveTab] = useState<(typeof TAB_OPTIONS)[number]>("PDF Viewer");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.resolve().then(async () => {
      try {
        const [caseStats, cases] = await Promise.all([
          api.cases.stats(),
          api.cases.list({ limit: 8 }),
        ]);
        setStats(caseStats);

        const primary = cases[0] ?? null;
        if (primary) {
          const [detail, plans] = await Promise.all([
            api.cases.get(primary.id).catch(() => null),
            api.actionPlans.byCase(primary.id).catch(() => [] as ActionPlan[]),
          ]);
          setSeed({
            caseItem: primary,
            caseDetail: detail,
            actionPlans: plans,
          });
        }
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }, []);

  const counts = stats?.status_counts ?? {};
  const totalFields = Math.max(7, (seed.caseDetail?.directives.length ?? 0) + 5);
  const verifiedFields = Math.min(
    totalFields,
    4 + seed.actionPlans.filter((plan) => plan.status === "COMPLETED" || plan.status === "AWAITING_REVIEW").length,
  );
  const confidence = Math.round((seed.caseDetail?.confidence_score ?? seed.caseItem?.confidence_score ?? 0.84) * 100);
  const primaryDirective = seed.caseDetail?.directives[0] ?? null;
  const directiveCards = seed.caseDetail?.directives.slice(0, 2) ?? [];
  const departmentCount = new Set(seed.actionPlans.map((plan) => plan.assigned_department)).size || 2;
  const deadlineCards = (stats?.upcoming_deadlines ?? []).slice(0, 2);
  const timelineItems = buildTimeline(seed.actionPlans, user?.name);

  return (
    <main className="h-full overflow-y-auto bg-[#f5f7fb]">
      <div className="mx-auto flex min-h-full w-full max-w-[1280px] flex-col px-8 py-8">
        <TopBar userName={user?.name ?? "Officer"} designation={user?.designation ?? user?.role ?? "Reviewer"} />

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Could not load dashboard data: {error}
          </div>
        ) : null}

        <HeroPanel
          caseDetail={seed.caseDetail}
          caseItem={seed.caseItem}
          confidence={confidence}
          totalFields={totalFields}
          verifiedFields={verifiedFields}
        />

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_1.05fr_0.55fr]">
          <SurfaceCard className="overflow-hidden p-0">
            <div className="border-b border-slate-200 px-5 pt-4">
              <div className="flex items-center gap-8 text-sm font-medium text-slate-500">
                {TAB_OPTIONS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "border-b-2 pb-3 transition",
                      activeTab === tab
                        ? "border-indigo-500 text-indigo-700"
                        : "border-transparent text-slate-500 hover:text-slate-700",
                    )}
                  >
                    {tab}
                    {tab === "Directive Blocks" ? (
                      <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-600">
                        {seed.caseDetail?.directives.length ?? 7}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4">
              {activeTab === "PDF Viewer" ? (
                <PdfCanvas
                  caseNumber={seed.caseItem?.case_number ?? "WP 23456/2025"}
                  pages={seed.caseDetail?.page_count ?? 68}
                  highlightOne={directiveCards[0]?.text ?? "The respondents shall reconsider the petitioner's claim and pass a speaking order within 8 weeks from the date of receipt of this order."}
                  highlightTwo={directiveCards[1]?.text ?? "The 2nd respondent shall ensure compliance and submit a compliance affidavit before the Registrar on or before 15 Jul 2025."}
                />
              ) : activeTab === "Extracted Text" ? (
                <ExtractedTextPane directives={seed.caseDetail?.directives.map((directive) => directive.text) ?? []} />
              ) : (
                <DirectiveBlockPane directives={seed.caseDetail?.directives ?? []} />
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-[22px] font-semibold text-slate-900">Extracted Fields</h2>
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                  Review Mode
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <FieldCard
                label="Case Number"
                value={seed.caseItem?.case_number ?? "WP 23456/2025"}
                verified
                score={98}
              />
              <FieldCard
                label="Parties"
                value={seed.caseItem?.petitioners ?? "ABC Infrastructure Pvt. Ltd. vs State of Karnataka & Ors."}
                verified
                score={92}
              />
              <FieldCard
                label="Court"
                value={seed.caseItem?.court ?? "High Court of Karnataka, Bengaluru"}
                verified
                score={96}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <FieldCard
                  label="Order Date"
                  value={formatCardDate(seed.caseItem?.judgment_date) || "24 Apr 2025"}
                  verified
                />
                <FieldCard
                  label="Received Date"
                  value={formatCardDate(seed.caseItem?.filed_at) || "25 Apr 2025"}
                  verified
                />
              </div>

              {(directiveCards.length > 0 ? directiveCards : [primaryDirective].filter(Boolean)).map((directive, index) =>
                directive ? (
                  <DirectiveReviewCard
                    key={directive.id}
                    directive={directive.text}
                    department={directive.department}
                    dueDate={formatCardDate(directive.deadline) || "15 Jul 2025"}
                    actionType={directive.action_type}
                    score={index === 0 ? 95 : 93}
                  />
                ) : null,
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <FieldCard label="Action Type" value={primaryDirective?.action_type ?? "Comply"} verified />
                <FieldCard label="Appeal Limitation" value="90 days from 24 Apr 2025" status="Review" />
              </div>
            </div>
          </SurfaceCard>

          <div className="space-y-5">
            <SidebarPanel title="Action Plan Summary">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Total Directions" value={seed.caseDetail?.directives.length ?? 2} />
                <MiniStat label="To Departments" value={departmentCount} />
                <MiniStat label="Comply" value={seed.actionPlans.filter((plan) => plan.action_type === "COMPLY").length || 2} />
                <MiniStat label="Appeal" value={seed.actionPlans.filter((plan) => plan.action_type === "APPEAL").length} />
                <MiniStat label="Inform" value={seed.actionPlans.filter((plan) => plan.action_type === "INFORM").length} />
                <MiniStat label="Monitor" value={seed.actionPlans.filter((plan) => plan.action_type === "MONITOR").length} />
              </div>
            </SidebarPanel>

            <SidebarPanel title="Deadlines" actionLabel="View Calendar">
              <div className="space-y-3">
                {(deadlineCards.length > 0 ? deadlineCards : fallbackDeadlines()).map((item, index) => (
                  <DeadlineCard
                    key={`${item.case_id}-${index}`}
                    department={item.department}
                    title={item.action_type ?? (index === 0 ? "Speaking Order" : "Compliance Affidavit")}
                    deadline={item.deadline}
                  />
                ))}
              </div>
            </SidebarPanel>

            <SidebarPanel title="Audit Trail" actionLabel="View All">
              <div className="space-y-4">
                {timelineItems.map((item, index) => (
                  <AuditItem key={`${item.title}-${index}`} {...item} />
                ))}
              </div>
            </SidebarPanel>

            <SidebarPanel title="Export">
              <div className="space-y-3">
                <ActionButton label="Export Verified Action Plan" icon={Download} primary={false} />
                <ActionButton label="Export PDF" icon={Download} primary={false} />
              </div>
            </SidebarPanel>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-4">
          <MetricStrip label="Pending Review" value={counts.PENDING_REVIEW ?? 0} tone="amber" />
          <MetricStrip label="Verified" value={counts.VERIFIED ?? 0} tone="emerald" />
          <MetricStrip label="Actioned" value={counts.ACTIONED ?? 0} tone="blue" />
          <MetricStrip label="Appealed" value={counts.APPEALED ?? 0} tone="violet" />
        </section>
      </div>
    </main>
  );
}

function TopBar({ designation, userName }: { designation: string; userName: string }) {
  return (
    <div className="mb-5 flex items-center justify-between rounded-[26px] border border-slate-200 bg-white px-6 py-4 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)]">
      <div className="flex items-center gap-5">
        <button className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Cases</span>
          <ChevronRight className="h-4 w-4" />
          <span>WP 23456/2025</span>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-slate-700">Review &amp; Verify</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-500">
          <Bell className="h-4 w-4" />
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
            3
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-500">
          <SunMedium className="h-4 w-4" />
          <Moon className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5a43d5] text-sm font-semibold text-white">
            {initials(userName)}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">{userName}</p>
            <p className="text-xs text-slate-500">{designation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroPanel({
  caseDetail,
  caseItem,
  confidence,
  totalFields,
  verifiedFields,
}: {
  caseDetail: CaseDetail | null;
  caseItem: CaseListItem | null;
  confidence: number;
  totalFields: number;
  verifiedFields: number;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white px-6 py-6 shadow-[0_20px_48px_-36px_rgba(15,23,42,0.4)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[38px] font-semibold tracking-tight text-slate-950">
              {caseItem?.case_number ?? "WP 23456/2025"}
            </h1>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
              {caseItem?.court ?? "High Court of Karnataka"}
            </span>
          </div>
          <p className="mt-3 text-[22px] text-slate-700">
            {caseItem?.petitioners ?? "ABC Infrastructure Pvt. Ltd. vs State of Karnataka & Ors."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-slate-500">
            <MetaPill icon={CalendarDays} label={`Order Date: ${formatCardDate(caseItem?.judgment_date) || "24 Apr 2025"}`} />
            <MetaPill icon={Clock3} label={`Received: ${formatCardDate(caseItem?.filed_at) || "25 Apr 2025"}`} />
            <MetaPill icon={FileText} label={`Pages: ${caseDetail?.page_count ?? 68}`} />
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:min-w-[470px] xl:flex-row xl:justify-end">
          <CompactProgressCard title="Overall Confidence" value={`${confidence}%`} statusLabel="Good" progress={confidence} accent="emerald" />
          <CompactProgressCard title="Review Progress" value={`${verifiedFields} / ${totalFields}`} statusLabel="Fields Verified" progress={Math.round((verifiedFields / totalFields) * 100)} accent="blue" />
          <div className="flex items-start gap-3 xl:ml-2">
            <ActionButton label="Save Draft" icon={FileText} />
            <ActionButton label="Submit Verified" icon={CheckCircle2} primary />
          </div>
        </div>
      </div>
    </div>
  );
}

function SurfaceCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[26px] border border-slate-200 bg-white shadow-[0_20px_50px_-38px_rgba(15,23,42,0.4)]", className)}>
      {children}
    </div>
  );
}

function SidebarPanel({
  actionLabel,
  children,
  title,
}: {
  actionLabel?: string;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.35)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[22px] font-semibold text-slate-900">{title}</h3>
        {actionLabel ? <button className="text-sm font-semibold text-indigo-600">{actionLabel}</button> : null}
      </div>
      {children}
    </div>
  );
}

function CompactProgressCard({
  accent,
  progress,
  statusLabel,
  title,
  value,
}: {
  accent: "blue" | "emerald";
  progress: number;
  statusLabel: string;
  title: string;
  value: string;
}) {
  const accentBar = accent === "emerald" ? "bg-emerald-500" : "bg-blue-500";
  const accentText = accent === "emerald" ? "text-emerald-600" : "text-slate-500";
  return (
    <div className="min-w-[170px] rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-[34px] font-semibold text-slate-950">{value}</span>
        <span className={cn("pb-2 text-xs font-semibold", accentText)}>{statusLabel}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", accentBar)} style={{ width: `${Math.max(12, progress)}%` }} />
      </div>
    </div>
  );
}

function MetaPill({ icon: Icon, label }: { icon: typeof CalendarDays; label: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-400" />
      <span>{label}</span>
    </div>
  );
}

function PdfCanvas({
  caseNumber,
  highlightOne,
  highlightTwo,
  pages,
}: {
  caseNumber: string;
  highlightOne: string;
  highlightTwo: string;
  pages: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between rounded-t-[18px] bg-[#1f2430] px-5 py-3 text-white">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">{caseNumber}_Judgment.pdf</span>
          <span className="text-slate-300">23 / {pages}</span>
          <span className="text-slate-300">100%</span>
        </div>
        <div className="flex items-center gap-3 text-slate-300">
          <span>−</span>
          <span>+</span>
          <span>|</span>
          <span>⤢</span>
        </div>
      </div>
      <div className="rounded-b-[18px] border border-t-0 border-slate-200 bg-[#f6f7fb] p-4">
        <div className="relative flex min-h-[640px] gap-4 rounded-[18px] border border-slate-200 bg-white p-5 shadow-inner">
          <div className="w-full pr-12">
            <div className="mx-auto max-w-[560px] space-y-4 font-serif text-[15px] leading-8 text-slate-800">
              <p className="text-center text-[22px] font-semibold">IN THE HIGH COURT OF KARNATAKA AT BENGALURU</p>
              <p className="text-center">DATED THIS THE 24<sup>TH</sup> DAY OF APRIL, 2025</p>
              <p className="text-center font-semibold">PRESENT</p>
              <p className="text-center">THE HON&apos;BLE MR. JUSTICE R. DEVADATTA</p>
              <p>WRIT PETITION No. {caseNumber.replace("WP ", "")} (GM-RES)</p>
              <p>ABC Infrastructure Pvt. Ltd.,</p>
              <p className="text-right italic">...Petitioner</p>
              <p className="text-center">Versus</p>
              <p>State of Karnataka &amp; Ors.</p>
              <p className="text-right italic">...Respondents</p>
              <p className="text-center font-semibold tracking-[0.3em]">ORDER</p>
              <p>
                1. This writ petition is filed challenging the order dated 10.03.2025 passed by the Executive Engineer,
                Public Works Department, rejecting the petitioner&apos;s claim for additional payment.
              </p>
              <p>
                2.{" "}
                <span className="rounded bg-[#f8e56f] px-1 py-0.5">
                  {highlightOne}
                </span>
              </p>
              <p>
                3.{" "}
                <span className="rounded bg-[#b6ed8b] px-1 py-0.5">
                  {highlightTwo}
                </span>
              </p>
              <p>4. With the above directions, the writ petition stands disposed of.</p>
            </div>
          </div>

          <div className="absolute right-4 top-16 flex flex-col gap-3">
            {["✦", "☞", "✎", "⬤", "⬤", "⌫", "↺"].map((item, index) => (
              <button
                key={`${item}-${index}`}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-[#20242d] text-white shadow-sm",
                  index === 3 && "text-[#f7d942]",
                  index === 4 && "text-[#79dc6b]",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Directive Blocks ({7})</h4>
            <span className="text-slate-400">✣</span>
          </div>
          <div className="grid grid-cols-3 gap-3 xl:grid-cols-7">
            {["Block 1", "Block 2", "Block 3", "Block 4", "Block 5", "Block 6", "Block 7"].map((block, index) => (
              <button
                key={block}
                className={cn(
                  "rounded-2xl border px-3 py-3 text-left transition",
                  index === 2
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <p className="text-sm font-semibold">{block}</p>
                <p className="mt-1 text-xs">Pg {5 + index * 9}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExtractedTextPane({ directives }: { directives: string[] }) {
  const content = directives.length > 0 ? directives : [
    "The respondents shall reconsider the petitioner's claim and pass a speaking order within 8 weeks from the date of receipt of this order.",
    "The Executive Engineer, PWD shall ensure compliance and submit a compliance affidavit before the Registrar on or before 15 Jul 2025.",
  ];

  return (
    <div className="rounded-[20px] border border-slate-200 bg-[#fafbff] p-5">
      <h3 className="text-lg font-semibold text-slate-900">Extracted Judgment Text</h3>
      <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
        {content.map((item, index) => (
          <p key={`${item.slice(0, 18)}-${index}`}>
            {index + 1}. {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function DirectiveBlockPane({ directives }: { directives: CaseDetail["directives"] }) {
  const content = directives.length > 0 ? directives : [
    {
      id: "fallback-1",
      text: "Reconsider the petitioner's claim and pass a speaking order within 8 weeks.",
      department: "Public Works Department",
      deadline: null,
      action_type: "COMPLY",
      confidence_score: 0.95,
      is_ambiguous: false,
      status: "VERIFIED",
    } as CaseDetail["directives"][number],
  ];

  return (
    <div className="space-y-3">
      {content.map((directive, index) => (
        <div key={directive.id} className="rounded-[20px] border border-slate-200 bg-[#fafbff] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Direction {index + 1}
            </span>
            <span className="text-sm font-semibold text-slate-500">{Math.round(directive.confidence_score * 100)}%</span>
          </div>
          <p className="text-sm leading-6 text-slate-700">{directive.text}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 px-3 py-1">{directive.department}</span>
            <span className="rounded-full border border-slate-200 px-3 py-1">{directive.action_type}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldCard({
  label,
  score,
  status,
  value,
  verified,
}: {
  label: string;
  score?: number;
  status?: string;
  value: string;
  verified?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-start justify-between gap-4">
        <p className="max-w-[80%] text-sm leading-6 text-slate-800">{value}</p>
        <div className="flex items-center gap-3">
          <StatusBadge status={status ?? (verified ? "Verified" : "Draft")} />
          {typeof score === "number" ? <span className="text-xs font-semibold text-slate-500">{score}%</span> : null}
          <button className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function DirectiveReviewCard({
  actionType,
  department,
  directive,
  dueDate,
  score,
}: {
  actionType: string;
  department: string;
  directive: string;
  dueDate: string;
  score: number;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          Direction 1 (Action)
        </span>
        <div className="flex items-center gap-3">
          <StatusBadge status="Verified" />
          <span className="text-xs font-semibold text-slate-500">{score}%</span>
          <button className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
            Edit
          </button>
        </div>
      </div>
      <p className="text-sm leading-6 text-slate-800">{directive}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <FieldCard label="Responsible Department" value={department} verified />
        <FieldCard label="Timeline" value={dueDate} verified />
        <FieldCard label="Action Type" value={actionType} verified />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Verified"
      ? "bg-emerald-50 text-emerald-600"
      : status === "Review"
        ? "bg-amber-50 text-amber-600"
        : "bg-slate-100 text-slate-500";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 text-center">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-[30px] font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function DeadlineCard({
  deadline,
  department,
  title,
}: {
  deadline: string;
  department: string;
  title: string;
}) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <p className="text-sm font-semibold text-slate-900">{department} - {title}</p>
          </div>
          <p className="mt-2 text-xs text-slate-500">Due: {formatDate(deadline)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-700">in {daysFromNow(deadline)} days</p>
          <p className="mt-1 text-xs font-semibold text-emerald-600">On Track</p>
        </div>
      </div>
    </div>
  );
}

function AuditItem({
  actor,
  detail,
  title,
  when,
}: {
  actor: string;
  detail: string;
  title: string;
  when: string;
}) {
  return (
    <div className="relative pl-6">
      <span className="absolute left-0 top-1 h-3 w-3 rounded-full bg-indigo-500" />
      <span className="absolute left-[5px] top-4 h-[calc(100%+4px)] w-px bg-slate-200 last:hidden" />
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{actor}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
      <p className="mt-1 text-xs text-slate-400">{when}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  primary,
}: {
  icon: typeof FileText;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition",
        primary
          ? "bg-[#5a43d5] text-white shadow-[0_14px_34px_-18px_rgba(90,67,213,0.85)] hover:brightness-105"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MetricStrip({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "amber" | "blue" | "emerald" | "violet";
  value: number;
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
  };

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.4)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-[32px] font-semibold text-slate-950">{value}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", tones[tone])}>{label}</span>
      </div>
    </div>
  );
}

function buildTimeline(actionPlans: ActionPlan[], reviewerName?: string) {
  if (actionPlans.length === 0) {
    return [
      {
        title: "Verified Direction 1 - Timeline",
        actor: `${reviewerName ?? "Reviewer"} (Reviewer)`,
        detail: "8 weeks from receipt date",
        when: "Today, 10:32 AM",
      },
      {
        title: "Edited Due Date - Direction 2",
        actor: `${reviewerName ?? "Reviewer"} (Reviewer)`,
        detail: "15 Jul 2025",
        when: "Today, 10:28 AM",
      },
      {
        title: "Extracted 7 directive blocks from PDF",
        actor: "System (AI Extractor)",
        detail: "Court judgment parsed successfully",
        when: "Today, 09:41 AM",
      },
    ];
  }

  return actionPlans.slice(0, 3).map((plan, index) => ({
    title:
      plan.status === "COMPLETED"
        ? `Completed ${plan.action_type} workflow`
        : plan.status === "AWAITING_REVIEW"
          ? `Submitted ${plan.action_type} for review`
          : `Updated ${plan.action_type} action plan`,
    actor: `${reviewerName ?? "Officer"} (${plan.assigned_department})`,
    detail: formatCardDate(plan.due_date) || "Timeline updated",
    when: index === 0 ? "Today, 10:32 AM" : index === 1 ? "Today, 10:28 AM" : "Today, 09:41 AM",
  }));
}

function fallbackDeadlines() {
  return [
    {
      case_id: "fallback-1",
      department: "PWD",
      deadline: new Date(Date.now() + 52 * 86400000).toISOString(),
      action_type: "Speaking Order",
    },
    {
      case_id: "fallback-2",
      department: "PWD",
      deadline: new Date(Date.now() + 82 * 86400000).toISOString(),
      action_type: "Compliance Affidavit",
    },
  ];
}

function formatCardDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysFromNow(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  return Math.max(1, Math.ceil(diff / 86400000));
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
