import { supabase } from "@/lib/supabase";

const TEST_NAMES = ["test", "test2", "test3", "test4", "test5"];

function toISODateStart(d: string): string {
  return new Date(`${d}T00:00:00`).toISOString();
}

function toISODateEnd(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  dt.setHours(23, 59, 59, 999);
  return dt.toISOString();
}

function bucketKey(iso: string, groupBy: string): string {
  const d = new Date(iso);
  if (groupBy === "day") {
    return d.toISOString().split("T")[0];
  }
  // month
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const groupBy = searchParams.get("groupby") === "day" ? "day" : "month";

  try {
    // 1. Resolve user names + test-account ids (case-insensitive exact match)
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, name");
    const nameById = new Map<string, string>();
    const testIds = new Set<string>();
    (allUsers || []).forEach((u) => {
      nameById.set(u.id, u.name);
      if (TEST_NAMES.includes(String(u.name || "").toLowerCase().trim())) {
        testIds.add(u.id);
      }
    });

    // 2. Admin loads ONLY (fund_ledger type=admin_load), newest first
    let loadQuery = supabase
      .from("fund_ledger")
      .select("user_id, amount, balance_before, balance_after, description, created_at")
      .eq("type", "admin_load")
      .order("created_at", { ascending: false })
      .limit(10000);

    if (from) loadQuery = loadQuery.gte("created_at", toISODateStart(from));
    if (to) loadQuery = loadQuery.lte("created_at", toISODateEnd(to));

    const { data: loadRows, error: loadError } = await loadQuery;
    if (loadError) throw new Error(loadError.message);

    const loads = (loadRows || []).filter((l) => !testIds.has(l.user_id));

    // 3. Admin deductions (fund_ledger type=admin_deduct, amounts stored negative), newest first
    let deductQuery = supabase
      .from("fund_ledger")
      .select("user_id, amount, balance_before, balance_after, description, created_at")
      .eq("type", "admin_deduct")
      .order("created_at", { ascending: false })
      .limit(10000);

    if (from) deductQuery = deductQuery.gte("created_at", toISODateStart(from));
    if (to) deductQuery = deductQuery.lte("created_at", toISODateEnd(to));

    const { data: deductRows, error: deductError } = await deductQuery;
    if (deductError) throw new Error(deductError.message);

    const deducts = (deductRows || []).filter((d) => !testIds.has(d.user_id));

    // ---- Summary ----
    const totalLoaded = loads.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const uniquePlayers = new Set(loads.map((l) => l.user_id)).size;
    const totalDeducted = deducts.reduce(
      (s, r) => s + Math.abs(Number(r.amount) || 0),
      0
    );

    // ---- Breakdown by day/month ----
    const buckets = new Map<
      string,
      { total: number; count: number; deducted: number; deduct_count: number }
    >();
    loads.forEach((l) => {
      if (!l.created_at) return;
      const k = bucketKey(l.created_at, groupBy);
      const cur = buckets.get(k) ?? { total: 0, count: 0, deducted: 0, deduct_count: 0 };
      cur.total += Number(l.amount) || 0;
      cur.count += 1;
      buckets.set(k, cur);
    });
    deducts.forEach((d) => {
      if (!d.created_at) return;
      const k = bucketKey(d.created_at, groupBy);
      const cur = buckets.get(k) ?? { total: 0, count: 0, deducted: 0, deduct_count: 0 };
      cur.deducted += Math.abs(Number(d.amount) || 0);
      cur.deduct_count += 1;
      buckets.set(k, cur);
    });

    const breakdown = [...buckets.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, v]) => ({
        date,
        load_count: v.count,
        total: v.total,
        deduct_count: v.deduct_count,
        deducted: v.deducted,
      }));

    // ---- Top players by total loaded ----
    const perUser = new Map<string, { total: number; load_count: number }>();
    loads.forEach((l) => {
      const name = nameById.get(l.user_id) ?? "Unknown";
      const cur = perUser.get(name) ?? { total: 0, load_count: 0 };
      cur.total += Number(l.amount) || 0;
      cur.load_count += 1;
      perUser.set(name, cur);
    });
    const topUsers = [...perUser.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // ---- Recent fund activity: loads + deductions merged, newest first, cap 50 ----
    const recentActivity = [
      ...loads.map((l) => ({
        type: "admin_load" as const,
        player: nameById.get(l.user_id) ?? "Unknown",
        amount: Number(l.amount) || 0,
        balance_before: l.balance_before,
        balance_after: l.balance_after,
        description: l.description,
        created_at: l.created_at,
      })),
      ...deducts.map((d) => ({
        type: "admin_deduct" as const,
        player: nameById.get(d.user_id) ?? "Unknown",
        amount: Math.abs(Number(d.amount) || 0),
        balance_before: d.balance_before,
        balance_after: d.balance_after,
        description: d.description,
        created_at: d.created_at,
      })),
    ]
      .sort((a, b) =>
        String(a.created_at) < String(b.created_at) ? 1 : -1
      )
      .slice(0, 50);

    return Response.json({
      summary: {
        total_loaded: totalLoaded,
        load_count: loads.length,
        unique_players: uniquePlayers,
        total_deducted: totalDeducted,
        deduct_count: deducts.length,
      },
      breakdown,
      top_users: topUsers,
      recent_loads: recentActivity,
      groupby: groupBy,
      excludes_test_accounts: TEST_NAMES,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to build report";
    return Response.json({ error: message }, { status: 500 });
  }
}
