import React from "react";
import { AlertTriangle, FileText, ShieldCheck, Users } from "lucide-react";
import Badge from "./ui/Badge";
import { formatValue } from "./utils";

const toNumber = (v) => {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  // handles "72", "72.5", "72%"
  const cleaned = String(v).replace("%", "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const asText = (label, value) =>
  value == null ? `${label}: —` : `${label}: ${formatValue(value)}`;

export default function BulletinBoard({ totals, userStats, stats, loading }) {
  const open = toNumber(stats?.openCount);
  const completion = toNumber(stats?.completionRate);
  const totalComplaints = toNumber(totals?.totalComplaints);
  const resolvedToday = toNumber(stats?.resolvedToday);
  const totalUsers = toNumber(totals?.totalUsers);
  const admins = toNumber(userStats?.admins);

  const completionText =
    completion == null ? "Completion rate: —" : `Completion rate: ${completion.toFixed(0)}%`;

  const opsBadge =
    open != null && open > 10
      ? { text: "Attention", variant: "rose" }
      : { text: "Stable", variant: "amber" };

  const items = [
    {
      key: "ops",
      title: "Operations",
      icon: AlertTriangle,
      badge: opsBadge.text,
      badgeVariant: opsBadge.variant,
      lines: [asText("Open items", open), completionText],
    },
    {
      key: "complaints",
      title: "Complaints",
      icon: FileText,
      badge: "Live",
      badgeVariant: "emerald",
      lines: [asText("Total complaints", totalComplaints), asText("Resolved today", resolvedToday)],
    },
    {
      key: "users",
      title: "Users",
      icon: Users,
      badge: "Directory",
      badgeVariant: "blue",
      lines: [asText("Total users", totalUsers), asText("Admins", admins)],
    },
    {
      key: "policy",
      title: "Guidelines",
      icon: ShieldCheck,
      badge: "Policy",
      badgeVariant: "slate",
      lines: [
        "Resolve only after adding a resolution note.",
        "Prioritize urgent tickets under 48h.",
      ],
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.key}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <it.icon className="h-5 w-5 text-gray-700" />
                <p className="text-sm font-extrabold text-gray-900">{it.title}</p>
              </div>

              <div className="mt-3 space-y-1">
                {loading ? (
                  <>
                    <div className="h-4 w-40 rounded bg-gray-100 animate-pulse" />
                    <div className="h-4 w-32 rounded bg-gray-100 animate-pulse" />
                  </>
                ) : (
                  it.lines.map((line, idx) => (
                    <p key={idx} className="text-sm text-gray-600">
                      {line}
                    </p>
                  ))
                )}
              </div>
            </div>

            <Badge variant={it.badgeVariant}>{it.badge}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
