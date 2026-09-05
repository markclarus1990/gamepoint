"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  BarChart3,
  CircleDollarSign,
  Wallet,
  Users,
  Trophy,
  ReceiptText,
} from "lucide-react";

type BreakdownRow = {
  date: string;
  load_count: number;
  total: number;
  deduct_count: number;
  deducted: number;
};

type TopUser = {
  name: string;
  total: number;
  load_count: number;
};

type RecentLoad = {
  type: "admin_load" | "admin_deduct";
  player: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  created_at: string;
};

type ReportData = {
  summary: {
    total_loaded: number;
    load_count: number;
    unique_players: number;
    total_deducted: number;
    deduct_count: number;
  };
  breakdown: BreakdownRow[];
  top_users: TopUser[];
  recent_loads: RecentLoad[];
  groupby: string;
};

const GRADIENT =
  "bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function monthStartISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function IncomeReports() {
  const [authorized, setAuthorized] = useState(false);
  const [fromDate, setFromDate] = useState(monthStartISO());
  const [toDate, setToDate] = useState(todayISO());
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isAdmin = localStorage.getItem("isAdmin");
    if (isAdmin !== "true") {
      window.location.href = "/login";
    } else {
      setAuthorized(true);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        groupby: groupBy,
      });
      const res = await fetch(`/api/admin/income-report?${params.toString()}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Cannot reach the server");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, groupBy]);

  useEffect(() => {
    if (authorized) fetchReport();
  }, [authorized, fetchReport]);

  const setPreset = (preset: "today" | "week" | "month" | "lastmonth" | "year") => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().split("T")[0];
    if (preset === "today") {
      setFromDate(iso(now));
      setToDate(iso(now));
    } else if (preset === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      setFromDate(iso(start));
      setToDate(iso(now));
    } else if (preset === "month") {
      setFromDate(monthStartISO());
      setToDate(todayISO());
    } else if (preset === "lastmonth") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(iso(first));
      setToDate(iso(last));
    } else {
      setFromDate(`${now.getFullYear()}-01-01`);
      setToDate(todayISO());
    }
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
      </div>
    );
  }

  const summary = data?.summary;
  const maxTotal = Math.max(
    1,
    ...(data?.breakdown.map((b) => b.total + b.deducted) ?? [1])
  );

  const totalIncome = (summary?.total_loaded ?? 0) - (summary?.total_deducted ?? 0);

  const cards = [
    {
      label: "Total Income",
      value: `₱${totalIncome}`,
      icon: CircleDollarSign,
      color: "text-emerald-400 bg-emerald-500/10",
    },
    {
      label: "Total Loaded (gfunds)",
      value: `₱${summary?.total_loaded ?? 0}`,
      icon: CircleDollarSign,
      color: "text-emerald-400 bg-emerald-500/10",
    },
    {
      label: "Admin Loads",
      value: `${summary?.load_count ?? 0}`,
      icon: Wallet,
      color: "text-purple-400 bg-purple-500/10",
    },
    {
      label: "Players Loaded",
      value: `${summary?.unique_players ?? 0}`,
      icon: Users,
      color: "text-pink-400 bg-pink-500/10",
    },
    {
      label: "Total Deducted",
      value: `₱${summary?.total_deducted ?? 0}`,
      icon: Wallet,
      color: "text-red-400 bg-red-500/10",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-wide flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-pink-500" />
              Income <span className="text-pink-500">Reports</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Gfunds loaded &amp; deducted by admins • Excludes test accounts (test, test2 – test5)
            </p>
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white ${GRADIENT} disabled:opacity-50 transition-all`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 bg-[#1e293b] border border-white/5 rounded-xl text-sm [color-scheme:dark]"
            />
            <span className="text-zinc-500 text-sm">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 bg-[#1e293b] border border-white/5 rounded-xl text-sm [color-scheme:dark]"
            />
            <div className="flex gap-1 bg-zinc-900/60 p-1 rounded-xl">
              {(["day", "month"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    groupBy === g
                      ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {g === "day" ? "Daily" : "Monthly"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["today", "Today"],
                ["week", "Last 7 days"],
                ["month", "This month"],
                ["lastmonth", "Last month"],
                ["year", "This year"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/70 text-zinc-400 hover:text-white transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {cards.map((s) => (
            <div
              key={s.label}
              className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className={`p-2.5 rounded-xl ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black leading-tight truncate">{s.value}</div>
                <div className="text-[11px] text-zinc-500 truncate">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 sm:p-5">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-pink-500" />
            {groupBy === "day" ? "Daily" : "Monthly"} loads
          </h2>
          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
            </div>
          ) : !data || data.breakdown.length === 0 ? (
            <div className="text-sm text-zinc-500 py-8 text-center">
              No admin loads in this range.
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {data.breakdown.map((b) => (
                <div key={b.date} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">{b.date}</span>
                    <span className="font-bold">
                      <span className="text-emerald-400">+₱{b.total}</span>
                      {b.deducted > 0 && (
                        <span className="text-red-400"> −₱{b.deducted}</span>
                      )}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-zinc-800/70 overflow-hidden flex">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                      style={{ width: `${(b.total / maxTotal) * 100}%` }}
                      title={`Loads ₱${b.total} across ${b.load_count} loads`}
                    />
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${(b.deducted / maxTotal) * 100}%` }}
                      title={`Deducted ₱${b.deducted} across ${b.deduct_count} deductions`}
                    />
                  </div>
                  <div className="flex gap-3 text-[10px] text-zinc-500">
                    <span>Loads ₱{b.total} ({b.load_count})</span>
                    <span>Deducted ₱{b.deducted} ({b.deduct_count})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-4 mt-3 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" /> Admin loads
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Admin deductions
            </span>
          </div>
        </div>

        {/* Detail table */}
        {data && data.breakdown.length > 0 && (
          <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 sm:p-5 overflow-x-auto">
            <h2 className="font-bold mb-3">Details</h2>
            <table className="w-full text-sm text-zinc-400 min-w-[520px]">
              <thead className="text-xs text-zinc-500 border-b border-white/5">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-right">Loads</th>
                  <th className="p-2 text-right">Total Loaded</th>
                  <th className="p-2 text-right">Deducts</th>
                  <th className="p-2 text-right">Total Deducted</th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.map((b) => (
                  <tr key={b.date} className="border-b border-white/5">
                    <td className="p-2">{b.date}</td>
                    <td className="p-2 text-right">{b.load_count}</td>
                    <td className="p-2 text-right font-bold text-emerald-400">₱{b.total}</td>
                    <td className="p-2 text-right">{b.deduct_count}</td>
                    <td className="p-2 text-right font-bold text-red-400">₱{b.deducted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Top players */}
        <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 sm:p-5">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Top players by loads received
          </h2>
          {!data || data.top_users.length === 0 ? (
            <div className="text-sm text-zinc-500 py-6 text-center">No data</div>
          ) : (
            <div className="space-y-1.5">
              {data.top_users.map((u, i) => (
                <div
                  key={u.name}
                  className="flex items-center justify-between bg-zinc-900/50 border border-white/5 px-3 py-2.5 rounded-xl"
                >
                  <div className="text-sm font-medium truncate">
                    <span className="text-zinc-500 mr-2">#{i + 1}</span>
                    {u.name}
                    <span className="text-zinc-500 text-xs ml-2">
                      {u.load_count} loads
                    </span>
                  </div>
                  <div className="text-sm font-bold text-emerald-400">₱{u.total}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent fund activity */}
        <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 sm:p-5">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-purple-400" /> Recent fund activity
          </h2>
          {!data || data.recent_loads.length === 0 ? (
            <div className="text-sm text-zinc-500 py-6 text-center">
              No admin loads or deductions recorded yet. They will appear here once admins add or deduct gfunds.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {data.recent_loads.map((l, i) => {
                const isDeduct = l.type === "admin_deduct";
                return (
                  <div
                    key={`${l.created_at}-${i}`}
                    className="flex items-center justify-between gap-2 bg-zinc-900/50 border border-white/5 px-3 py-2.5 rounded-xl"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        <span className={`font-bold ${isDeduct ? "text-red-400" : "text-emerald-400"}`}>
                          {isDeduct ? "−" : "+"}₱{l.amount}
                        </span>
                        <span className="text-zinc-400"> → {l.player}</span>
                        <span className="text-zinc-600 text-[10px] ml-2">
                          {isDeduct ? "deduct" : "load"}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        ₱{l.balance_before} → ₱{l.balance_after}
                        {l.description ? ` • ${l.description}` : ""}
                      </div>
                    </div>
                    <div className="text-[11px] text-zinc-500 shrink-0">
                      {new Date(l.created_at).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
