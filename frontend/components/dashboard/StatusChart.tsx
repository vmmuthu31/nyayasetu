"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { STATUS_COLORS } from "@/lib/utils";

const LABELS: Record<string, string> = {
  PENDING_REVIEW: "Pending Review",
  VERIFIED: "Verified",
  ACTIONED: "Actioned",
  APPEALED: "Appealed",
  REJECTED: "Rejected",
};

export function StatusChart({ counts }: { counts: Record<string, number> }) {
  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: LABELS[key] ?? key, value, key }));

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={80} paddingAngle={3}>
          {data.map((entry) => (
            <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => [v, "Cases"]} />
        <Legend iconType="circle" iconSize={10} />
      </PieChart>
    </ResponsiveContainer>
  );
}
