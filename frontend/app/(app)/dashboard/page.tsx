"use client";

import { useEffect, useState } from "react";
import { ClipboardList, CheckCircle, Zap, Gavel } from "lucide-react";
import { api, StatsResponse } from "@/lib/api";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { StatusChart } from "@/components/dashboard/StatusChart";
import { DeadlinesList } from "@/components/dashboard/DeadlinesList";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.cases.stats()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  const counts = stats?.status_counts ?? {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Welcome back, <span className="font-medium">{user?.name}</span> · {user?.designation ?? user?.role}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          Could not load stats: {error}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Pending Review"
          value={counts.PENDING_REVIEW ?? "—"}
          icon={ClipboardList}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <StatsCard
          label="Verified"
          value={counts.VERIFIED ?? "—"}
          icon={CheckCircle}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatsCard
          label="Actioned"
          value={counts.ACTIONED ?? "—"}
          icon={Zap}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatsCard
          label="Appealed"
          value={counts.APPEALED ?? "—"}
          icon={Gavel}
          color="text-violet-600"
          bg="bg-violet-50"
        />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Deadlines */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Upcoming Deadlines</h2>
          <DeadlinesList deadlines={stats?.upcoming_deadlines ?? []} />
        </div>

        {/* Status Overview Chart */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-2">Status Overview</h2>
          <StatusChart counts={counts} />
        </div>
      </div>
    </div>
  );
}
