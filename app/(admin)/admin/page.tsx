"use client";
import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from "react";
import {
  Loader2,
  Monitor,
  Power,
  RotateCcw,
  Camera,
  KeyRound,
  Trash2,
  Plus,
  Users,
  ShoppingBag,
  Gift,
  History,
  X,
  Search,
  Check,
  Clock,
  MessageCircle,
  CircleDollarSign,
  LogOut,
  Download,
  Share2,
  Activity,
  Play,
  Square,
  Minus,
  Wallet,
  Trophy,
  AlertTriangle,
} from "lucide-react";

type User = {
  id: string;
  name: string;
  points: number;
  gfunds?: number;
  time_credit_minutes?: number;
  remaining_seconds?: number;
  total_available_seconds?: number;
};

type Session = {
  user_name: string;
  amount: number;
  minutes: number;
  created_at: string;
};
type Redeem = {
  id: string;
  user_id: string;
  points_used: number;
  minutes: number;
  status: string;
  created_at: string;
  users?: { name: string };
};

type ShopOrder = {
  id: string;
  product_id: string;
  user_id: string;
  points_spent: number;
  status: string;
  created_at: string;
  products?: { name: string; points_cost: number };
  users?: { name: string };
};

type Station = {
  id: string;
  name: string;
  agent_key: string;
  online: boolean;
  active: { user_name: string; ends_at?: string } | null;
  remaining_seconds: number;
  screenshot_url?: string | null;
  screenshot_at?: string | null;
  user_avatar?: string | null;
};

type Tab = "stations" | "requests" | "shop" | "users" | "history" | "activity";

type ActivityLogEntry = {
  id: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type LedgerRow = {
  id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  created_at: string;
};

type TimelineItem = {
  source: "activity" | "point_ledger" | "fund_ledger" | "session";
  entry: Record<string, unknown>;
  created_at: string;
};

type PlayerHistoryData = {
  user: { id: string; name: string; points: number; gfunds: number };
  point_ledger: { data: LedgerRow[]; total: number };
  fund_ledger: { data: LedgerRow[]; total: number };
  sessions: { data: Session[]; totalMinutes: number };
  redeems: { data: Redeem[]; total: number };
  activity_log: { data: ActivityLogEntry[] };
  timeline?: TimelineItem[];
  summary: {
    total_points_earned: number;
    total_points_spent: number;
    total_gfunds_loaded: number;
    total_gfunds_deducted: number;
    total_session_minutes: number;
  };
};

type IconComponent = React.ComponentType<{ className?: string }>;

type FormattedEvent = {
  Icon: IconComponent;
  color: string;
  title: string;
  subtitle: string;
};

// Human-readable rendering for an activity_log row:
// shows who did what, where it came from and where it went.
function formatActivityLog(log: ActivityLogEntry): FormattedEvent {
  const d = (log.details ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => Number(v) || 0;
  const str = (v: unknown) => String(v ?? "");
  const target = str(log.target_id);

  switch (log.action) {
    case "session_share": {
      const mins = num(d.minutes);
      const fromStation = str(d.source_station);
      const toStation = str(d.target_station ?? d.target_station_before);
      const giverRemaining = d.giver_remaining_before !== undefined ? ` • had ${Math.floor(num(d.giver_remaining_before) / 60)}m left` : "";
      const creditBefore = d.target_credit_before !== undefined ? ` • target had ${num(d.target_credit_before)}m credit` : "";
      return {
        Icon: Share2,
        color: "text-sky-400 bg-sky-500/10 border border-sky-500/20",
        title: `Shared ${mins} mins → ${target || "?"}`,
        subtitle: `From ${log.actor_name}${fromStation ? ` (${fromStation})` : ""} → ${target || "?"}${toStation ? ` (${toStation})` : ""}${giverRemaining}${creditBefore}`,
      };
    }
    case "session_share_failed": {
      const mins = num(d.minutes);
      const station = str(d.source_station);
      const reason = str(d.reason);
      return {
        Icon: X,
        color: "text-red-400 bg-red-500/10 border border-red-500/20",
        title: `Failed share ${mins} mins → ${target} (${reason})`,
        subtitle: `From ${log.actor_name}${station ? ` (${station})` : ""}`,
      };
    }
    case "credit_consume": {
      const station = str(d.station);
      const credit = num(d.credit_minutes);
      const remaining = d.remaining_seconds !== undefined ? ` • ${Math.floor(num(d.remaining_seconds) / 60)}m left` : "";
      return {
        Icon: Clock,
        color: "text-teal-400 bg-teal-500/10",
        title: `${log.actor_name} used ${credit}m shared time on ${station || "?"}`,
        subtitle: `Where shared time went — consumed${remaining}`,
      };
    }
    case "add_time": {
      const station = str(d.station);
      const payment = str(d.payment);
      const mins = num(d.minutes_added);
      const g = num(d.gfundsUsed);
      const p = num(d.pointsUsed);
      const paid = payment === "gfunds" ? `₱${g}` : `${p} pts`;
      return {
        Icon: Plus,
        color: "text-purple-400 bg-purple-500/10",
        title: `${log.actor_name} added ${mins}m on ${station || "?"} (${paid} via ${payment === "gfunds" ? "gfunds" : "gamepoints"})`,
        subtitle: `Where funds came from: ${payment} • remaining ${Math.floor(num(d.remaining_seconds) / 60)}m`,
      };
    }
    case "session_start": {
      const station = str(d.station || d.source_station);
      const payment = str(d.payment);
      const g = num(d.gfundsUsed ?? d.gfunds_used);
      const p = num(d.pointsUsed ?? d.points_used);
      const amt = num(d.amount);
      const mins = d.minutes !== undefined ? ` • ${num(d.minutes)}m` : "";
      const paid =
        payment === "gfunds" && g > 0
          ? `₱${g} gfunds`
          : payment === "points" && p > 0
            ? `${p} pts`
            : payment === "credit"
              ? `${num(d.credit_minutes ?? d.minutes)}m shared time`
              : amt > 0
                ? `₱${amt}`
                : payment || "credit";
      return {
        Icon: Play,
        color: payment === "credit" ? "text-teal-400 bg-teal-500/10" : "text-emerald-400 bg-emerald-500/10",
        title: `${log.actor_name} started on ${station || "?"} (${paid})${mins}`,
        subtitle:
          payment === "gfunds"
            ? `Added time using gfunds${mins} • from ₱${g}`
            : payment === "points"
              ? `Added time using gamepoints${mins} • from ${p} pts`
              : payment === "credit"
                ? `Where it came from: shared time pool • on ${station}`
                : `Payment: ${payment || "credit"}`,
      };
    }
    case "session_end":
      return {
        Icon: Square,
        color: "text-zinc-400 bg-zinc-500/10",
        title: `${log.actor_name} ended session${d.station ? ` on ${str(d.station)}` : ""}`,
        subtitle: "Session ended",
      };
    case "session_logout": {
      const secs = d.remaining_seconds !== undefined ? ` • ${Math.floor(num(d.remaining_seconds) / 60)}m saved` : "";
      const paused = d.was_paused ? " (paused)" : "";
      return {
        Icon: LogOut,
        color: "text-zinc-400 bg-zinc-500/10",
        title: `${log.actor_name} logged out${d.station ? ` from ${str(d.station)}` : ""}${secs}${paused}`,
        subtitle: "Player logout",
      };
    }
    case "session_resume": {
      const secs = d.resume_seconds !== undefined ? `${Math.floor(num(d.resume_seconds) / 60)}m` : d.remaining_seconds !== undefined ? `${Math.floor(num(d.remaining_seconds) / 60)}m` : "";
      return {
        Icon: Play,
        color: "text-amber-400 bg-amber-500/10",
        title: `${log.actor_name} resumed session${d.station ? ` on ${str(d.station)}` : ""}${secs ? ` (${secs})` : ""}`,
        subtitle: secs ? `Where time came from: paused session • ${secs} restored` : "Session resumed",
      };
    }
    case "admin_load": {
      const g = num(d.gfunds);
      const p = num(d.points);
      const parts: string[] = [];
      if (g > 0) parts.push(`₱${g} gfunds`);
      if (p > 0) parts.push(`${p} pts`);
      return {
        Icon: Wallet,
        color: "text-emerald-400 bg-emerald-500/10",
        title: `Admin loaded ${parts.join(" + ") || "—"} → ${target}`,
        subtitle: `Came from admin load`,
      };
    }
    case "admin_deduct_points":
      return {
        Icon: Minus,
        color: "text-red-400 bg-red-500/10",
        title: `Admin deducted ${num(d.points)} pts from ${target}`,
        subtitle: "Points taken back by admin",
      };
    case "admin_deduct_gfunds":
      return {
        Icon: Minus,
        color: "text-red-400 bg-red-500/10",
        title: `Admin deducted ₱${num(d.gfunds)} from ${target}`,
        subtitle: "Gfunds taken back by admin",
      };
    case "admin_open_time":
      return {
        Icon: Clock,
        color: "text-purple-400 bg-purple-500/10",
        title: `Admin opened ${num(d.minutes)} mins on ${target} (₱${num(d.pesos)})`,
        subtitle: "Walk-in time opened",
      };
    case "redeem_approve":
      return {
        Icon: Gift,
        color: "text-amber-400 bg-amber-500/10",
        title: `${target} redeemed ${num(d.points_used)} pts → ${num(d.minutes)} mins`,
        subtitle: "Points converted to game time",
      };
    case "shop_grant":
      return {
        Icon: ShoppingBag,
        color: "text-amber-400 bg-amber-500/10",
        title: `Granted "${str(d.product) || "item"}" for ${num(d.points_spent)} pts → ${target}`,
        subtitle: "Shop order granted",
      };
    case "station_command": {
      const cmd = str(d.command);
      const CmdIcon = cmd === "shutdown" ? Power : cmd === "restart" ? RotateCcw : Camera;
      return {
        Icon: CmdIcon,
        color: "text-zinc-400 bg-zinc-500/10",
        title: `Station ${cmd} (${num(d.station_count)} station${num(d.station_count) === 1 ? "" : "s"})`,
        subtitle: target,
      };
    }
    case "station_control_start":
      return {
        Icon: Monitor,
        color: "text-zinc-400 bg-zinc-500/10",
        title: `Remote control started on ${target}`,
        subtitle: `${log.actor_name} is viewing the screen`,
      };
    case "station_control_stop":
      return {
        Icon: Monitor,
        color: "text-zinc-400 bg-zinc-500/10",
        title: `Remote control stopped on ${target}`,
        subtitle: "Viewing session ended",
      };
    case "player_login": {
      const station = str(d.station);
      return {
        Icon: LogOut,
        color: "text-emerald-400 bg-emerald-500/10",
        title: `${log.actor_name} logged in${station ? ` on ${station}` : ""}`,
        subtitle: station ? `Login at ${station}` : "Player login",
      };
    }
    case "player_login_failed": {
      const reason = str(d.reason);
      return {
        Icon: X,
        color: "text-red-400 bg-red-500/10",
        title: `Failed login: ${target} (${reason})`,
        subtitle: "Login attempt rejected",
      };
    }
    case "player_logout":
      return {
        Icon: LogOut,
        color: "text-zinc-400 bg-zinc-500/10",
        title: `${log.actor_name} logged out`,
        subtitle: "Player logout",
      };
    case "pin_change":
      return {
        Icon: KeyRound,
        color: "text-amber-400 bg-amber-500/10",
        title: `${log.actor_name} changed PIN`,
        subtitle: "PIN updated via agent",
      };
    case "agent_screenshot": {
      const station = str(d.station ?? target);
      const bytes = num(d.image_bytes);
      return {
        Icon: Camera,
        color: "text-zinc-400 bg-zinc-500/10",
        title: `Screenshot from ${station} (${bytes > 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${bytes} B`})`,
        subtitle: "Agent uploaded screenshot",
      };
    }
    case "agent_command_done": {
      const station = str(d.station ?? target);
      const cmd = str(d.command);
      const CmdIcon = cmd === "shutdown" ? Power : cmd === "restart" ? RotateCcw : Camera;
      return {
        Icon: CmdIcon,
        color: "text-emerald-400 bg-emerald-500/10",
        title: `Agent on ${station} executed ${cmd}`,
        subtitle: "Command completed and cleared",
      };
    }
    default:
      return {
        Icon: Activity,
        color: "text-purple-400 bg-purple-500/10",
        title: `${log.action}${target ? ` → ${target}` : ""}`,
        subtitle: log.details
          ? Object.entries(log.details)
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join(" • ")
          : log.actor_name,
      };
  }
}

// Human-readable rendering for a unified timeline item
// (activity_log, fund_ledger, point_ledger or session row).
function formatTimelineItem(item: TimelineItem): FormattedEvent {
  const e = item.entry;
  const num = (v: unknown) => Number(v) || 0;
  const str = (v: unknown) => String(v ?? "");

  if (item.source === "activity") {
    return formatActivityLog(e as unknown as ActivityLogEntry);
  }
  if (item.source === "fund_ledger") {
    const amt = num(e.amount);
    const type = str(e.type);
    if (type === "admin_load") {
      return {
        Icon: Wallet,
        color: "text-emerald-400 bg-emerald-500/10",
        title: `Loaded +₱${amt} gfunds`,
        subtitle: `Came from admin • ₱${num(e.balance_before)} → ₱${num(e.balance_after)}`,
      };
    }
    if (type === "admin_deduct") {
      return {
        Icon: Minus,
        color: "text-red-400 bg-red-500/10",
        title: `Deducted −₱${Math.abs(amt)} gfunds`,
        subtitle: `Taken back by admin • ₱${num(e.balance_before)} → ₱${num(e.balance_after)}`,
      };
    }
    return {
      Icon: CircleDollarSign,
      color: "text-amber-400 bg-amber-500/10",
      title: `Spent −₱${Math.abs(amt)} gfunds on session`,
      subtitle: `${str(e.description) || type} • ₱${num(e.balance_before)} → ₱${num(e.balance_after)}`,
    };
  }
  if (item.source === "point_ledger") {
    const amt = num(e.amount);
    const positive = amt >= 0;
    return {
      Icon: Gift,
      color: positive
        ? "text-emerald-400 bg-emerald-500/10"
        : "text-red-400 bg-red-500/10",
      title: `${positive ? "+" : "−"}${Math.abs(amt)} pts (${str(e.type)})`,
      subtitle: `${str(e.description) || "points change"} • ${num(e.balance_before)} → ${num(e.balance_after)} pts`,
    };
  }
  // session
  return {
    Icon: Clock,
    color: "text-purple-400 bg-purple-500/10",
    title: `Session: ${num(e.minutes)} mins (₱${num(e.amount)})`,
    subtitle: str(e.station_name)
      ? `Played on ${str(e.station_name)}`
      : "Game session",
  };
}

const GRADIENT =
  "bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500";

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [deductAmount, setDeductAmount] = useState(0);
  const [deductType, setDeductType] = useState<"points" | "gfunds">("points");
  const [loadGfunds, setLoadGfunds] = useState(0);
  const [loadPoints, setLoadPoints] = useState(0);
  const [stations, setStations] = useState<Station[]>([]);
  const [newStationName, setNewStationName] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [openStation, setOpenStation] = useState<Station | null>(null);
  const [openPesos, setOpenPesos] = useState(0);
  const [openMinutes, setOpenMinutes] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [subTab, setSubTab] = useState<"sessions" | "points" | "funds" | "activity">("sessions");
  const [playerHistory, setPlayerHistory] = useState<PlayerHistoryData | null>(null);
  const [playerHistoryLoading, setPlayerHistoryLoading] = useState(false);
  const [fromActivityDate, setFromActivityDate] = useState("");
  const [toActivityDate, setToActivityDate] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [searchActivity, setSearchActivity] = useState("");
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [topSharers, setTopSharers] = useState<{ actor_name: string; share_count: number; total_minutes: number }[]>([]);
  const [topSharersLoading, setTopSharersLoading] = useState(false);
  const [pending, setPending] = useState<Redeem[]>([]);
  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([]);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [shopGrantingId, setShopGrantingId] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<Tab>("stations");
  const [viewStation, setViewStation] = useState<Station | null>(null);
  const [shareStation, setShareStation] = useState<Station | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<null | "load" | "deduct">(null);
  const [toast, setToast] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const isAdmin = localStorage.getItem("isAdmin");
    if (isAdmin !== "true") {
      window.location.href = "/login";
    } else {
      setAuthorized(true);
    }
  }, []);

  const loadUsers = async () => {
    const res = await fetch("/api/users");
    setUsers(await res.json());
  };

  const loadSessions = async (id: string) => {
    const res = await fetch(`/api/sessions?id=${id}`);
    const data = await res.json();
    setSessions(data.history || []);
  };

  const loadPending = async () => {
    const res = await fetch("/api/redeem/pending");
    setPending(await res.json());
  };

  const loadShopOrders = async () => {
    const res = await fetch("/api/products/purchases/pending");
    setShopOrders(await res.json());
  };

  const loadStations = async () => {
    const res = await fetch("/api/stations");
    const data = await res.json();
    setStations(data.stations || []);
  };

  useEffect(() => {
    loadPending();
    loadShopOrders();
    loadStations();

    pollRef.current = setInterval(() => {
      loadPending();
      loadShopOrders();
      loadStations();
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const fetchActivityLogs = async () => {
      if (tab !== "activity") {
        setActivityLogs([]);
        setActivityLoading(false);
        return;
      }
      setActivityLoading(true);
      try {
        const res = await fetch(`/api/admin/activity-log?from=${fromActivityDate}&to=${toActivityDate}&action=${actionFilter}&search=${searchActivity}`);
        const data = await res.json();
        setActivityLogs(data.data || []);
        setActivityLoading(false);
      } catch {
        setActivityLoading(false);
        notify("Failed to load activity log");
      }
    };

    const fetchTopSharers = async () => {
      if (tab !== "activity") {
        setTopSharers([]);
        return;
      }
      setTopSharersLoading(true);
      try {
        const params = new URLSearchParams();
        if (fromActivityDate) params.set("from", fromActivityDate);
        if (toActivityDate) params.set("to", toActivityDate);
        const res = await fetch(`/api/admin/top-sharers?${params.toString()}`);
        const data = await res.json();
        setTopSharers(data.top_sharers || []);
      } catch {
        // keep old
      } finally {
        setTopSharersLoading(false);
      }
    };

    fetchActivityLogs();
    fetchTopSharers();
    return () => {
      // cleanup
    };
  }, [tab, fromActivityDate, toActivityDate, actionFilter, searchActivity]);

  const loadPlayerHistory = async (id: string) => {
    setPlayerHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/player-history?user_id=${id}`);
      const data = await res.json();
      if (!data.error) setPlayerHistory(data);
    } catch {
      // keep old data on failure
    } finally {
      setPlayerHistoryLoading(false);
    }
  };

  const openHistory = (user: User) => {
    setSelectedUser(user);
    setSubTab("sessions");
    setPlayerHistory(null);
    loadSessions(user.id);
    loadPlayerHistory(user.id);
    setTab("history");
  };

  const deductPoints = async () => {
    if (!selectedUser || deductAmount <= 0 || busyAction) return;
    setBusyAction("deduct");
    try {
      const endpoint =
        deductType === "gfunds" ? "/api/deduct-gfunds" : "/api/deduct-points";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          deductType === "gfunds"
            ? { name: selectedUser.name, gfunds: deductAmount }
            : { name: selectedUser.name, points: deductAmount }
        ),
      });
      const data = await res.json();
      setShowDeductModal(false);
      setDeductAmount(0);
      loadUsers();
      loadSessions(selectedUser.id);
      notify(data.error || `Deducted from ${selectedUser.name}.`);
    } finally {
      setBusyAction(null);
    }
  };

  const loadAccount = async () => {
    if (!selectedUser || (loadGfunds <= 0 && loadPoints <= 0) || busyAction) return;
    setBusyAction("load");
    try {
      const res = await fetch("/api/admin/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUser.id,
          gfunds: loadGfunds,
          points: loadPoints,
        }),
      });
      const data = await res.json();
      if (data.error) {
        notify(data.error);
        return;
      }
      setShowModal(false);
      setLoadGfunds(0);
      setLoadPoints(0);
      loadUsers();
      notify(`Account loaded for ${selectedUser.name}.`);
    } finally {
      setBusyAction(null);
    }
  };

  const addStation = async () => {
    if (!newStationName.trim()) return;
    const res = await fetch("/api/stations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newStationName.trim() }),
    });
    const data = await res.json();
    if (data.error) {
      notify(data.error);
      return;
    }
    setNewStationName("");
    loadStations();
    notify(
      `Station "${data.station.name}" added! Agent key copied: ${data.station.agent_key}`
    );
    copyKey(data.station.agent_key);
  };

  const deleteStation = async (id: string, name: string) => {
    if (!confirm(`Delete station ${name}?`)) return;
    await fetch(`/api/stations/${id}`, { method: "DELETE" });
    loadStations();
    notify(`${name} deleted.`);
  };

  const sendStationCommand = async (
    ids: string[],
    command: "shutdown" | "restart" | "screenshot",
    target: string
  ) => {
    if (command === "shutdown" || command === "restart") {
      const verb = command === "restart" ? "restart" : "shut down";
      if (!confirm(`${verb[0].toUpperCase()}${verb.slice(1)} ${target}?`)) return;
    }
    setBusy(`${command}:${ids.join(",")}:${target}`);
    const res = await fetch("/api/stations/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, all: ids.length === 0, command }),
    });
    const data = await res.json();
    setBusy(null);
    notify(data.error || `Command sent to ${target}.`);
  };

  const endStationSession = async (name: string) => {
    if (!confirm(`End the active session on ${name}? The PC will lock.`)) return;
    await fetch("/api/sessions/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ station_name: name }),
    });
    loadStations();
    notify(`Session ended on ${name}.`);
  };

  const logoutStation = async (name: string) => {
    if (
      !confirm(
        `Log out ${name}? The session will be paused (time saved) and the PC will lock.`
      )
    ) {
      return;
    }
    const res = await fetch("/api/sessions/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ station_name: name }),
    });
    const data = await res.json();
    loadStations();
    notify(data.error || `${name} logged out — time saved.`);
  };

  const openStationTime = async () => {
    if (!openStation || openMinutes <= 0) return;
    const res = await fetch("/api/sessions/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        station_name: openStation.name,
        minutes: openMinutes,
      }),
    });
    const data = await res.json();
    if (data.error) {
      notify(data.error);
      return;
    }
    setOpenStation(null);
    setOpenPesos(0);
    setOpenMinutes(0);
    loadStations();
    notify(`${openMinutes} mins opened on ${openStation.name}.`);
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1500);
    } catch {
      prompt("Copy the agent key:", key);
    }
  };

  const formatRemaining = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? `${h}h ` : ""}${m}m ${s}s`;
  };

  const timeAgo = (iso: string | null | undefined) => {
    if (!iso) return null;
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 5) return "just now";
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSessions = sessions.filter((s) => {
    if (!fromDate && !toDate) return true;
    const sessionDate = new Date(s.created_at);
    if (fromDate) {
      const from = new Date(fromDate);
      if (sessionDate < from) return false;
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (sessionDate > to) return false;
    }
    return true;
  });

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
      </div>
    );
  }

  const onlineCount = stations.filter((s) => s.online).length;
  const inSessionCount = stations.filter((s) => s.active).length;

  const stats = [
    { label: "Stations Online", value: `${onlineCount}/${stations.length}`, icon: Monitor, color: "text-emerald-400 bg-emerald-500/10" },
    { label: "In Session", value: String(inSessionCount), icon: Clock, color: "text-pink-400 bg-pink-500/10" },
    { label: "Redeem Requests", value: String(pending.length), icon: Gift, color: "text-purple-400 bg-purple-500/10" },
    { label: "Shop Orders", value: String(shopOrders.length), icon: ShoppingBag, color: "text-amber-400 bg-amber-500/10" },
  ];

  const tabs: { id: Tab; label: string; icon: typeof Monitor; badge?: number }[] = [
    { id: "stations", label: "Stations", icon: Monitor },
    { id: "requests", label: "Requests", icon: Gift, badge: pending.length },
    { id: "shop", label: "Shop", icon: ShoppingBag, badge: shopOrders.length },
    { id: "users", label: "Users", icon: Users },
    { id: "history", label: "History", icon: History },
    { id: "activity", label: "Activity", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-wide">
              Admin <span className="text-pink-500">Dashboard</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {stations.length} stations • {onlineCount} online •{" "}
              {new Date().toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => (window.location.href = "/admin/chat")}
              className="flex items-center gap-1.5 bg-zinc-800/80 hover:bg-zinc-700/80 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Messages</span>
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("user");
                localStorage.removeItem("isAdmin");
                window.location.href = "/login";
              }}
              className="flex items-center gap-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className={`p-2.5 rounded-xl ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black leading-tight">{s.value}</div>
                <div className="text-[11px] text-zinc-500 truncate">
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="sticky top-14 z-30 -mx-3 sm:mx-0 bg-[#0b1220]/95 backdrop-blur px-3 sm:px-0 pb-1">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                  tab === t.id
                    ? `text-white ${GRADIENT} shadow-lg shadow-purple-900/40`
                    : "bg-zinc-800/60 text-zinc-400 hover:text-white"
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                {t.badge ? (
                  <span
                    className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      tab === t.id ? "bg-white/20" : "bg-pink-500/20 text-pink-400"
                    }`}
                  >
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* ============ STATIONS TAB ============ */}
        {tab === "stations" && (
          <div className="space-y-4">
            <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex flex-1 gap-2">
                  <input
                    placeholder="PC name (e.g. PC-1)"
                    value={newStationName}
                    onChange={(e) => setNewStationName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addStation()}
                    className="flex-1 px-3.5 py-2.5 bg-[#1e293b] border border-white/5 rounded-xl text-sm placeholder-zinc-500 outline-none focus:border-purple-500/60"
                  />
                  <button
                    onClick={addStation}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add PC
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => sendStationCommand([], "restart", "all PCs")}
                    disabled={stations.length === 0}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">Restart All</span>
                  </button>
                  <button
                    onClick={() => sendStationCommand([], "shutdown", "all PCs")}
                    disabled={stations.length === 0}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                  >
                    <Power className="w-4 h-4" />
                    <span className="hidden sm:inline">Shutdown All</span>
                  </button>
                </div>
              </div>
            </div>

            {stations.length === 0 ? (
              <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-10 text-center text-sm text-zinc-500">
                No stations yet. Add a PC above, then install the agent on it.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {stations.map((s) => (
                  <div
                    key={s.id}
                    className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`relative flex w-2.5 h-2.5 shrink-0 ${
                            s.active
                              ? "bg-emerald-400"
                              : s.online
                                ? "bg-amber-400"
                                : "bg-zinc-600"
                          } rounded-full`}
                        >
                          {(s.active || s.online) && (
                            <span
                              className={`absolute inline-flex w-full h-full ${s.active ? "bg-emerald-400" : "bg-amber-400"} rounded-full opacity-60 animate-ping`}
                            />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold truncate">{s.name}</div>
                          <div className="text-[11px] text-zinc-500">
                            {s.active ? (
                              <span className="text-emerald-400 flex items-center gap-1.5">
                                {s.user_avatar ? (
                                  <img
                                    src={s.user_avatar}
                                    alt={s.active.user_name}
                                    className="w-5 h-5 rounded-full object-cover bg-zinc-700 ring-1 ring-emerald-400/40"
                                  />
                                ) : (
                                  <span className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center">
                                    <Users className="w-3 h-3 text-zinc-400" />
                                  </span>
                                )}
                                {s.active.user_name} •{" "}
                                {formatRemaining(s.remaining_seconds)} left
                              </span>
                            ) : s.online ? (
                              <span className="text-amber-400">Online</span>
                            ) : (
                              <span className="text-zinc-500">Offline</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => copyKey(s.agent_key)}
                        title="Copy agent key"
                        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-zinc-800/70 hover:bg-zinc-700/70 text-zinc-400 transition-colors"
                      >
                        {copiedKey === s.agent_key ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <KeyRound className="w-3 h-3" />
                        )}
                        {copiedKey === s.agent_key ? "Copied" : "Key"}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setViewStation(s)}
                        disabled={!s.online}
                        title="View screen"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40 transition-all"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        View
                      </button>

                      {!s.active ? (
                        <button
                          onClick={() => {
                            setOpenStation(s);
                            setOpenPesos(0);
                            setOpenMinutes(0);
                          }}
                          disabled={!s.online}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Open Time
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setShareStation(s)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Share
                          </button>
                          <button
                            onClick={() => logoutStation(s.name)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Logout
                          </button>
                          <button
                            onClick={() => endStationSession(s.name)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <Power className="w-3.5 h-3.5" />
                            End
                          </button>
                        </>
                      )}

                      <button
                        onClick={() =>
                          sendStationCommand([s.id], "restart", s.name)
                        }
                        disabled={
                          busy === `restart:${s.id}:${s.name}` || !s.online
                        }
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
                      >
                        {busy === `restart:${s.id}:${s.name}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Restart
                      </button>

                      <button
                        onClick={() =>
                          sendStationCommand([s.id], "shutdown", s.name)
                        }
                        disabled={
                          busy === `shutdown:${s.id}:${s.name}` || !s.online
                        }
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                      >
                        {busy === `shutdown:${s.id}:${s.name}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Power className="w-3.5 h-3.5" />
                        )}
                        Shutdown
                      </button>

                      <button
                        onClick={() => deleteStation(s.id, s.name)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/70 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ REQUESTS TAB ============ */}
        {tab === "requests" && (
          <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 sm:p-5">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <Gift className="w-4 h-4 text-pink-500" /> Redeem Requests
            </h2>
            {pending.length === 0 ? (
              <div className="text-sm text-zinc-500 py-6 text-center">
                No pending requests
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 bg-zinc-900/50 border border-white/5 p-3 rounded-xl"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {r.users?.name || "Unknown"}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {r.points_used} pts • {r.minutes} mins •{" "}
                        {timeAgo(r.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (grantingId) return;
                        setGrantingId(r.id);
                        await fetch("/api/redeem/approve", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ request_id: r.id }),
                        });
                        setGrantingId(null);
                        loadPending();
                      }}
                      disabled={grantingId === r.id}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 transition-all"
                    >
                      {grantingId === r.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Grant
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ SHOP TAB ============ */}
        {tab === "shop" && (
          <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 sm:p-5">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-pink-500" /> Shop Orders
            </h2>
            {shopOrders.length === 0 ? (
              <div className="text-sm text-zinc-500 py-6 text-center">
                No pending orders
              </div>
            ) : (
              <div className="space-y-2">
                {shopOrders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between gap-3 bg-zinc-900/50 border border-white/5 p-3 rounded-xl"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {o.users?.name || "Unknown"}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {o.products?.name || "Unknown item"} • {o.points_spent}{" "}
                        pts • {timeAgo(o.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (shopGrantingId) return;
                        setShopGrantingId(o.id);
                        await fetch("/api/products/grant", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ order_id: o.id }),
                        });
                        setShopGrantingId(null);
                        loadShopOrders();
                      }}
                      disabled={shopGrantingId === o.id}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 transition-all"
                    >
                      {shopGrantingId === o.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Grant
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ USERS TAB ============ */}
        {tab === "users" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                placeholder="Search user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0f1b2e] border border-white/5 rounded-xl text-sm placeholder-zinc-500 outline-none focus:border-purple-500/60"
              />
            </div>
            <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl divide-y divide-white/5">
              {filteredUsers.length === 0 ? (
                <div className="text-sm text-zinc-500 py-8 text-center">
                  No users found
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{u.name}</div>
                      <div className="text-xs text-amber-400">
                        ₱{u.gfunds || 0} • {u.points || 0} pts
                        {u.time_credit_minutes ? (
                          <span className="text-teal-400">
                            {" "}
                            • {u.time_credit_minutes} free min
                          </span>
                        ) : null}
                        {u.total_available_seconds ? (
                          <span className="text-emerald-400">
                            {" "}
                            • {formatRemaining(u.total_available_seconds)} available
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setShowModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setShowDeductModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        Deduct
                      </button>
                      <button
                        onClick={() => openHistory(u)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
                      >
                        History
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============ HISTORY TAB ============ */}
        {tab === "history" && (
          <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap gap-2 mb-4">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 bg-[#1e293b] border border-white/5 rounded-xl text-sm [color-scheme:dark]"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 bg-[#1e293b] border border-white/5 rounded-xl text-sm [color-scheme:dark]"
              />
              <button
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setFromDate(today);
                  setToDate(today);
                }}
                className="px-3 py-2 rounded-xl text-sm font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="px-3 py-2 rounded-xl text-sm font-medium bg-zinc-800/70 text-zinc-400 hover:bg-zinc-700/70 transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={() => setSubTab("sessions")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  subTab === "sessions"
                    ? "bg-purple-500/10 text-purple-400"
                    : "bg-zinc-800/60 text-zinc-400 hover:text-white"
                  }`}
                >
                  Sessions
                </button>
                <button
                  onClick={() => setSubTab("points")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    subTab === "points"
                      ? "bg-amber-500/20 text-amber-400"
                    : "bg-zinc-800/60 text-zinc-400 hover:text-white"
                  }`}
                >
                  Points
                </button>
                <button
                  onClick={() => setSubTab("funds")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    subTab === "funds"
                      ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800/60 text-zinc-400 hover:text-white"
                  }`}
                >
                  Funds
                </button>
                <button
                  onClick={() => setSubTab("activity")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    subTab === "activity"
                      ? "bg-purple-500/10 text-purple-400"
                    : "bg-zinc-800/60 text-zinc-400 hover:text-white"
                  }`}
                >
                  Activity
                </button>
              </div>

            <h2 className="font-bold mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-pink-500" />
              {selectedUser
                ? `${selectedUser.name} History`
                : "Select a user"}
            </h2>

            {!selectedUser ? (
              <div className="text-sm text-zinc-500 py-8 text-center">
                No user selected. Pick one from the Users tab.
              </div>
            ) : subTab === "points" ? (
              playerHistoryLoading ? (
                <div className="text-sm text-zinc-500 py-8 text-center">Loading points history…</div>
              ) : !playerHistory || playerHistory.point_ledger.data.length === 0 ? (
                <div className="text-sm text-zinc-500 py-8 text-center">No points history for this user.</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-emerald-500/10 text-emerald-400 px-3 py-2 rounded-xl font-semibold">
                      Earned: +{playerHistory.summary.total_points_earned} pts
                    </div>
                    <div className="bg-red-500/10 text-red-400 px-3 py-2 rounded-xl font-semibold">
                      Spent: -{playerHistory.summary.total_points_spent} pts
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {playerHistory.point_ledger.data.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between bg-zinc-900/50 border border-white/5 px-3 py-2.5 rounded-xl"
                      >
                        <div className="min-w-0">
                          <div className={`text-sm font-bold ${e.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {e.amount >= 0 ? "+" : ""}{e.amount} pts
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate">
                            {e.type} • {e.balance_before} → {e.balance_after}
                            {e.description ? ` • ${e.description}` : ""}
                          </div>
                        </div>
                        <div className="text-[11px] text-zinc-500 shrink-0 ml-2">
                          {new Date(e.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : subTab === "funds" ? (
              playerHistoryLoading ? (
                <div className="text-sm text-zinc-500 py-8 text-center">Loading funds history…</div>
              ) : !playerHistory || playerHistory.fund_ledger.data.length === 0 ? (
                <div className="text-sm text-zinc-500 py-8 text-center">
                  No funds history for this user. Loads and deducts will appear here.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-emerald-500/10 text-emerald-400 px-3 py-2 rounded-xl font-semibold">
                      Loaded: +₱{playerHistory.summary.total_gfunds_loaded}
                    </div>
                    <div className="bg-red-500/10 text-red-400 px-3 py-2 rounded-xl font-semibold">
                      Deducted: -₱{playerHistory.summary.total_gfunds_deducted}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {playerHistory.fund_ledger.data.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between bg-zinc-900/50 border border-white/5 px-3 py-2.5 rounded-xl"
                      >
                        <div className="min-w-0">
                          <div className={`text-sm font-bold ${e.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {e.amount >= 0 ? "+₱" : "-₱"}{Math.abs(e.amount)}
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate">
                            {e.type} • ₱{e.balance_before} → ₱{e.balance_after}
                            {e.description ? ` • ${e.description}` : ""}
                          </div>
                        </div>
                        <div className="text-[11px] text-zinc-500 shrink-0 ml-2">
                          {new Date(e.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : subTab === "activity" ? (
              playerHistoryLoading ? (
                <div className="text-sm text-zinc-500 py-8 text-center">Loading activity…</div>
              ) : !playerHistory ||
                ((playerHistory.timeline ?? []).length === 0 &&
                  playerHistory.activity_log.data.length === 0) ? (
                <div className="text-sm text-zinc-500 py-8 text-center">
                  No recorded activity for this user yet. Time shares, session starts and admin actions will appear here.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(playerHistory.timeline && playerHistory.timeline.length > 0
                    ? playerHistory.timeline.map((item, i) => {
                        const f = formatTimelineItem(item);
                        const key = String(
                          (item.entry as { id?: unknown }).id ?? `${item.created_at}-${i}`
                        );
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-2.5 bg-zinc-900/50 border border-white/5 px-3 py-2.5 rounded-xl"
                          >
                            <div className={`p-2 rounded-lg shrink-0 ${f.color}`}>
                              <f.Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">
                                {f.title}
                              </div>
                              <div className="text-[11px] text-zinc-500 truncate">
                                {f.subtitle}
                              </div>
                            </div>
                            <div className="text-[11px] text-zinc-500 shrink-0">
                              {new Date(item.created_at).toLocaleString()}
                            </div>
                          </div>
                        );
                      })
                    : playerHistory.activity_log.data.map((log) => {
                        const f = formatActivityLog(log);
                        return (
                          <div
                            key={log.id}
                            className="flex items-center gap-2.5 bg-zinc-900/50 border border-white/5 px-3 py-2.5 rounded-xl"
                          >
                            <div className={`p-2 rounded-lg shrink-0 ${f.color}`}>
                              <f.Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">
                                {f.title}
                              </div>
                              <div className="text-[11px] text-zinc-500 truncate">
                                {f.subtitle}
                              </div>
                            </div>
                            <div className="text-[11px] text-zinc-500 shrink-0">
                              {new Date(log.created_at).toLocaleString()}
                            </div>
                          </div>
                        );
                      }))}
                </div>
              )
            ) : sessions.length === 0 ? (
              <div className="text-sm text-zinc-500 py-8 text-center">
                No history for this user.
              </div>
            ) : (
              (() => {
                const groups: Record<string, typeof sessions> = {};
                filteredSessions.forEach((s) => {
                  const date = new Date(s.created_at).toDateString();
                  if (!groups[date]) groups[date] = [];
                  groups[date].push(s);
                });

                if (Object.keys(groups).length === 0) {
                  return (
                    <div className="text-sm text-zinc-500 py-8 text-center">
                      No sessions in this date range.
                    </div>
                  );
                }

                return Object.entries(groups).map(([date, items]) => {
                  const today = new Date().toDateString();
                  const label = date === today ? "Today" : date;
                  const totalMinutes = items.reduce((sum, s) => sum + s.minutes, 0);
                  const totalAmount = items.reduce((sum, s) => sum + s.amount, 0);
                  return (
                    <div key={date} className="mb-4">
                      <div className="text-xs text-zinc-500 mb-2">
                        {label}
                      </div>
                      <div className="space-y-1.5">
                        {items.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between bg-zinc-900/50 border border-white/5 px-3 py-2.5 rounded-xl"
                          >
                            <div className="text-sm font-medium">
                              ₱{s.amount} • {s.minutes} mins
                            </div>
                            <div className="text-xs text-zinc-500">
                              {new Date(s.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-purple-400 mt-2 flex justify-between font-medium">
                        <span>Total: {totalMinutes} mins</span>
                        <span>₱{totalAmount}</span>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}
      </div>

      {/* ============ ACTIVITY LOG TAB ============ */}
      {tab === "activity" && (
        <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="date"
              value={fromActivityDate}
              onChange={(e) => setFromActivityDate(e.target.value)}
              className="px-3 py-2 bg-[#1e293b] border border-white/5 rounded-xl text-sm [color-scheme:dark]"
              placeholder="From"
            />
            <input
              type="date"
              value={toActivityDate}
              onChange={(e) => setToActivityDate(e.target.value)}
              className="px-3 py-2 bg-[#1e293b] border border-white/5 rounded-xl text-sm [color-scheme:dark]"
              placeholder="To"
            />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 bg-[#1e293b] border border-white/5 rounded-xl text-sm placeholder-zinc-500 outline-none focus:border-purple-500/60"
            >
              <option value="">All Actions</option>
              <option value="admin_load">Admin Load</option>
              <option value="admin_deduct_points">Admin Deduct Points</option>
              <option value="admin_deduct_gfunds">Admin Deduct Gfunds</option>
              <option value="session_start">Session Start</option>
              <option value="session_end">Session End</option>
              <option value="session_logout">Session Logout</option>
              <option value="session_resume">Session Resume</option>
              <option value="session_share">Session Share ✓</option>
              <option value="session_share_failed">Share Failed</option>
              <option value="credit_consume">Credit Consume</option>
              <option value="add_time">Add Time</option>
              <option value="admin_open_time">Admin Open Time</option>
              <option value="redeem_approve">Redeem Approve</option>
              <option value="shop_grant">Shop Grant</option>
              <option value="station_command">Station Command</option>
              <option value="station_control_start">Station Control Start</option>
              <option value="station_control_stop">Station Control Stop</option>
              <option value="agent_screenshot">Agent Screenshot</option>
              <option value="agent_command_done">Agent Command Done</option>
              <option value="player_login">Player Login</option>
              <option value="player_login_failed">Login Failed</option>
              <option value="player_logout">Player Logout</option>
              <option value="pin_change">PIN Change</option>
            </select>
            <input
              type="text"
              value={searchActivity}
              onChange={(e) => setSearchActivity(e.target.value)}
              placeholder="Search player, station or action..."
              className="px-3 py-2 bg-[#1e293b] border border-white/5 rounded-xl text-sm placeholder-zinc-500 outline-none focus:border-purple-500/60 w-64"
            />
            <button
              onClick={() => { setFromActivityDate(""); setToActivityDate(""); setActionFilter(""); setSearchActivity(""); }}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-zinc-800/70 text-zinc-400 hover:bg-zinc-700/70 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Quick filters for stealing detection */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setActionFilter("session_share")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${actionFilter === "session_share" ? "bg-sky-500 text-white" : "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20"}`}
            >
              Shares only ✓
            </button>
            <button
              onClick={() => setActionFilter("credit_consume")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${actionFilter === "credit_consume" ? "bg-teal-500 text-white" : "bg-zinc-800/70 text-zinc-400 hover:text-white"}`}
            >
              Credit used
            </button>
            <button
              onClick={() => setActionFilter("add_time")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${actionFilter === "add_time" ? "bg-purple-500 text-white" : "bg-zinc-800/70 text-zinc-400 hover:text-white"}`}
            >
              Add time
            </button>
            <button
              onClick={() => setActionFilter("player_login")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${actionFilter === "player_login" ? "bg-emerald-500 text-white" : "bg-zinc-800/70 text-zinc-400 hover:text-white"}`}
            >
              Logins
            </button>
            <button
              onClick={() => setActionFilter("pin_change")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${actionFilter === "pin_change" ? "bg-amber-500 text-white" : "bg-zinc-800/70 text-zinc-400 hover:text-white"}`}
            >
              PIN changes
            </button>
            <button
              onClick={() => setActionFilter("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${actionFilter === "" ? "bg-white/10 text-white" : "bg-zinc-800/70 text-zinc-400 hover:text-white"}`}
            >
              All
            </button>
          </div>

          {/* Top sharers — stealing detection */}
          <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-sky-500/10 to-purple-500/10 border border-sky-500/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold tracking-widest text-sky-400 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Top sharers — could be stealing?
              </h3>
              {topSharersLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />}
            </div>
            {topSharers.length === 0 ? (
              <div className="text-xs text-zinc-500 py-2">
                {topSharersLoading ? "Loading…" : "No shares in this period."}
              </div>
            ) : (
              <div className="space-y-1.5">
                {topSharers.map((s, i) => {
                  const isSuspicious = s.share_count >= 5 || s.total_minutes >= 60;
                  return (
                    <button
                      key={s.actor_name}
                      onClick={() => {
                        setSearchActivity(s.actor_name);
                        setActionFilter("session_share");
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left hover:brightness-110 transition ${isSuspicious ? "bg-red-500/10 border border-red-500/20" : "bg-zinc-900/50 border border-white/5"}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-zinc-500 font-bold">#{i + 1}</span>
                        <span className="font-semibold text-white truncate">{s.actor_name}</span>
                        {isSuspicious && (
                          <span className="flex items-center gap-1 text-red-400 font-bold shrink-0">
                            <AlertTriangle className="w-3 h-3" /> Check
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="font-bold text-sky-400">{s.share_count} shares</span>
                        <span className="text-zinc-500"> • {s.total_minutes}m total</span>
                      </div>
                    </button>
                  );
                })}
                <div className="text-[10px] text-zinc-500 pt-1">
                  Flagged if ≥5 shares or ≥60 mins shared in period. Click a name to search.
                </div>
              </div>
            )}
          </div>

          <h2 className="font-bold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-pink-500" /> Activity Log
            {actionFilter === "session_share" && (
              <span className="text-xs font-normal text-sky-400 border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 rounded-full">
                Shares: from → to, station, minutes, where credit went
              </span>
            )}
          </h2>

          {activityLoading ? (
            <div className="text-sm text-zinc-500 py-8 text-center">Loading activity log...</div>
          ) : activityLogs.length === 0 ? (
            <div className="text-sm text-zinc-500 py-8 text-center">
              No activity log entries found. Start logging by performing admin actions.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-zinc-400">
                <thead className="text-xs text-zinc-500 border-b border-white/5">
                  <tr>
                    <th className="p-3 text-left">Time</th>
                    <th className="p-3 text-left">Event</th>
                    <th className="p-3 text-left">From → To</th>
                    <th className="p-3 text-left">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map((log) => {
                    const f = formatActivityLog(log);
                    const directedActions = new Set([
                      "session_share",
                      "session_share_failed",
                      "admin_load",
                      "admin_deduct_points",
                      "admin_deduct_gfunds",
                      "shop_grant",
                      "redeem_approve",
                    ]);
                    const parties = directedActions.has(log.action) && log.target_id
                      ? `${log.actor_name} → ${log.target_id}`
                      : log.action === "credit_consume"
                        ? `${log.actor_name} → ${String(log.details?.station ?? log.target_id ?? "")}`
                        : log.actor_role === "admin" && log.target_id
                          ? `${log.actor_name} → ${log.target_id}`
                          : log.actor_name;
                    const isShareRow = log.action === "session_share";
                    return (
                      <tr key={log.id} className={`border-b border-white/5 hover:bg-zinc-900/50 ${isShareRow ? "bg-sky-500/[0.04]" : ""}`}>
                        <td className="p-3 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className={`p-1.5 rounded-lg shrink-0 ${f.color}`}>
                              <f.Icon className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-medium text-zinc-200">{f.title}</span>
                          </div>
                        </td>
                        <td className="p-3 font-medium whitespace-nowrap">
                          {parties}
                        </td>
                        <td className="p-3 text-[11px]">
                          {f.subtitle}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ DEDUCT MODAL ============ */}
      {showDeductModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-md bg-[#0f1b2e] border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">
                Deduct{" "}
                {deductType === "gfunds" ? "Gfunds" : "Points"} —{" "}
                <span className="text-pink-500">{selectedUser.name}</span>
              </h2>
              <button
                onClick={() => setShowDeductModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 bg-zinc-900/60 p-1 rounded-xl">
              {(["points", "gfunds"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDeductType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    deductType === t
                      ? t === "points"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-emerald-500/20 text-emerald-400"
                      : "text-zinc-500"
                  }`}
                >
                  {t === "points" ? "Points" : "Gfunds"}
                </button>
              ))}
            </div>

            <div className="text-sm text-zinc-400">
              Current {deductType === "gfunds" ? "gfunds" : "points"}:{" "}
              <span className="font-semibold text-white">
                {deductType === "gfunds"
                  ? `₱${selectedUser.gfunds || 0}`
                  : selectedUser.points || 0}
              </span>
            </div>

            <div className="text-sm text-teal-400">
              Available time:{" "}
              {formatRemaining(selectedUser.total_available_seconds || 0)}
            </div>

            <input
              type="number"
              min={1}
              placeholder={
                deductType === "gfunds"
                  ? "Enter gfunds amount (₱)"
                  : "Enter points to deduct"
              }
              value={deductAmount}
              onChange={(e) => setDeductAmount(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-white/5 rounded-xl text-sm placeholder-zinc-500 outline-none focus:border-red-500/60"
            />

            <button
              onClick={deductPoints}
              disabled={deductAmount <= 0 || busyAction === "deduct"}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {busyAction === "deduct" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Deducting…
                </>
              ) : (
                "Confirm Deduct"
              )}
            </button>
            <button
              onClick={() => {
                setShowDeductModal(false);
                setDeductAmount(0);
              }}
              className="w-full py-2 text-sm text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ============ LOAD MODAL ============ */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-md bg-[#0f1b2e] border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">
                Load Account —{" "}
                <span className="text-pink-500">{selectedUser.name}</span>
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-sm text-zinc-400">
              Current: ₱{selectedUser.gfunds || 0} gfunds •{" "}
              {selectedUser.points || 0} pts
            </div>

            <div className="text-sm text-teal-400">
              Available time:{" "}
              {formatRemaining(selectedUser.total_available_seconds || 0)}
            </div>

            <div>
              <input
                type="number"
                placeholder="Gfunds (pesos)"
                value={loadGfunds}
                onChange={(e) => setLoadGfunds(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-white/5 rounded-xl text-sm placeholder-zinc-500 outline-none focus:border-emerald-500/60"
              />
              <div className="text-xs text-zinc-500 mt-1">1₱ = 4 mins of gfunds time</div>
            </div>

            <div>
              <input
                type="number"
                placeholder="Bonus gamepoints"
                value={loadPoints}
                onChange={(e) => setLoadPoints(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-white/5 rounded-xl text-sm placeholder-zinc-500 outline-none focus:border-emerald-500/60"
              />
              <div className="text-xs text-zinc-500 mt-1">20 pts = 8 mins of game time</div>
            </div>

            <button
              onClick={loadAccount}
              disabled={busyAction === "load" || (loadGfunds <= 0 && loadPoints <= 0)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
            >
              {busyAction === "load" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </>
              ) : (
                "Load"
              )}
            </button>
            <button
              onClick={() => {
                setShowModal(false);
                setLoadGfunds(0);
                setLoadPoints(0);
              }}
              className="w-full py-2 text-sm text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ============ OPEN TIME MODAL ============ */}
      {openStation && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-md bg-[#0f1b2e] border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">
                Open Time — <span className="text-pink-500">{openStation.name}</span>
              </h2>
              <button
                onClick={() => setOpenStation(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="text-sm text-zinc-400 mb-1">Amount paid (₱)</div>
              <input
                type="number"
                value={openPesos}
                onChange={(e) => {
                  const p = Number(e.target.value);
                  setOpenPesos(p);
                  setOpenMinutes(p * 4);
                }}
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-white/5 rounded-xl text-sm placeholder-zinc-500 outline-none focus:border-emerald-500/60"
                placeholder="0"
              />
            </div>

            <div>
              <div className="text-sm text-zinc-400 mb-1">Minutes</div>
              <input
                type="number"
                value={openMinutes}
                onChange={(e) => setOpenMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-white/5 rounded-xl text-sm placeholder-zinc-500 outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 60, 120].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setOpenMinutes(m);
                    setOpenPesos(m / 4);
                  }}
                  className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                    openMinutes === m
                      ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white"
                      : "bg-zinc-800/70 text-zinc-400 hover:text-white"
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>

            <button
              onClick={openStationTime}
              disabled={openMinutes <= 0}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 transition-all"
            >
              Open {openMinutes > 0 ? `${openMinutes} mins` : "Time"}
            </button>
            <button
              onClick={() => {
                setOpenStation(null);
                setOpenPesos(0);
                setOpenMinutes(0);
              }}
              className="w-full py-2 text-sm text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ============ SHARE TIME MODAL ============ */}
      {shareStation && (
        <ShareModal
          station={shareStation}
          users={users}
          onClose={() => setShareStation(null)}
          onDone={(msg) => {
            setShareStation(null);
            notify(msg);
            loadStations();
          }}
        />
      )}

      {/* ============ SCREENSHOT MODAL ============ */}
      {viewStation && (
        <ScreenshotModal
          station={viewStation}
          stations={stations}
          onClose={() => setViewStation(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-sm font-medium shadow-2xl shadow-black/50 max-w-[90vw]">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ============ SCREENSHOT MODAL ============ */
function ScreenshotModal({
  station,
  stations,
  onClose,
}: {
  station: Station;
  stations: Station[];
  onClose: () => void;
}) {
  const [requesting, setRequesting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlling, setControlling] = useState(false);
  const [controlText, setControlText] = useState("");
  const [lastClick, setLastClick] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [localStations, setLocalStations] = useState(stations);
  const controllingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const live = localStations.find((s) => s.id === station.id) ?? station;
  const imgUrl = live.screenshot_url;
  const shotAt = live.screenshot_at;
  const age = shotAt ? Math.floor((Date.now() - new Date(shotAt).getTime()) / 1000) : null;
  const fresh = age !== null && age <= 30;

  useEffect(() => {
    let alive = true;

    if (controlling) {
      let tick = 0;
      const iv = setInterval(async () => {
        try {
          const res = await fetch("/api/stations");
          const data = await res.json();
          if (alive) setLocalStations(data.stations || []);
        } catch {
          /* keep polling */
        }
        tick += 1;
        if (alive && tick % 2 === 0) {
          try {
            await fetch("/api/stations/command", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: [station.id], command: "screenshot" }),
            });
          } catch {
            /* keep polling */
          }
        }
      }, 2000);
      return () => {
        alive = false;
        clearInterval(iv);
      };
    }

    const requestShot = async () => {
      if (!alive) return;
      try {
        const res = await fetch("/api/stations/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [station.id], command: "screenshot" }),
        });
        const data = await res.json();
        if (data.error) setError(data.error);
      } catch {
        /* keep polling */
      }
    };

    requestShot();
    const iv = setInterval(requestShot, 8000);
    const timeout = setTimeout(() => setRequesting(false), 4000);

    return () => {
      alive = false;
      clearInterval(iv);
      clearTimeout(timeout);
    };
  }, [controlling, station.id]);

  useEffect(() => {
    return () => {
      if (controllingRef.current) {
        void fetch("/api/stations/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [station.id], action: "stop" }),
        }).catch(() => {});
      }
    };
  }, [station.id]);

  const toggleControl = async () => {
    const action = controlling ? "stop" : "start";
    try {
      const res = await fetch("/api/stations/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [station.id], action }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
    } catch {
      setError("Cannot reach the server");
      return;
    }
    setControlling(action === "start");
    controllingRef.current = action === "start";
    setRequesting(false);
    setError(null);
  };

  const imgPoint = (e: { clientX: number; clientY: number }) => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.round((e.clientX - rect.left) * (img.naturalWidth / rect.width)),
      y: Math.round(
        (e.clientY - rect.top) * (img.naturalHeight / rect.height)
      ),
      w: img.naturalWidth,
      h: img.naturalHeight,
    };
  };

  const sendEvent = async (event: unknown) => {
    try {
      await fetch("/api/stations/control/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationId: station.id, event }),
      });
    } catch {
      /* drop — the next action will retry */
    }
  };

  const onImgMouseDown = (e: ReactMouseEvent) => {
    if (!controlling) return;
    if (e.button !== 0 && e.button !== 2) return;
    const p = imgPoint(e);
    if (!p) return;
    dragStartRef.current = p;
    setLastClick(p);
    void sendEvent({
      type: "click",
      x: p.x,
      y: p.y,
      button: e.button === 2 ? "right" : "left",
    });
  };

  const onImgMouseUp = (e: ReactMouseEvent) => {
    if (!controlling) return;
    const start = dragStartRef.current;
    const p = imgPoint(e);
    dragStartRef.current = null;
    if (!start || !p) return;
    if (Math.abs(p.x - start.x) > 6 || Math.abs(p.y - start.y) > 6) {
      void sendEvent({ type: "drag", x1: start.x, y1: start.y, x2: p.x, y2: p.y });
    }
  };

  const onImgWheel = (e: ReactWheelEvent) => {
    if (!controlling) return;
    void sendEvent({ type: "scroll", delta: e.deltaY > 0 ? 1 : -1 });
  };

  const sendText = () => {
    const t = controlText;
    if (!t) return;
    setControlText("");
    void sendEvent({ type: "text", text: t });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-3xl bg-[#0f1b2e] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`relative flex w-2.5 h-2.5 shrink-0 ${
                live.active
                  ? "bg-emerald-400"
                  : live.online
                    ? "bg-amber-400"
                    : "bg-zinc-600"
              } rounded-full`}
            />
              <div className="min-w-0">
                <div className="font-bold truncate">{live.name}</div>
                <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                  {live.active && (
                    <>
                      {live.user_avatar ? (
                        <img
                          src={live.user_avatar}
                          alt={live.active.user_name}
                          className="w-4 h-4 rounded-full object-cover bg-zinc-700"
                        />
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center">
                          <Users className="w-2.5 h-2.5 text-zinc-400" />
                        </span>
                      )}
                    </>
                  )}
                  {live.active
                    ? `${live.active.user_name} • ${formatRemainingShort(live.remaining_seconds)} left`
                    : live.online
                      ? "Online"
                      : "Offline"}
                </div>
              </div>
            {fresh && (
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleControl}
              disabled={!live.online}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                controlling
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : "bg-emerald-600/80 hover:bg-emerald-500/80 text-white"
              }`}
            >
              {controlling ? "Stop control" : "Control"}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative bg-black/40 min-h-[240px] flex-1 flex items-center justify-center overflow-hidden">
          {!imgUrl ? (
            <div className="text-center space-y-3 py-16">
              <Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto" />
              <div className="text-sm text-zinc-400">
                {live.online
                  ? requesting
                    ? "Requesting screen capture…"
                    : "No capture yet — waiting for the station to respond…"
                  : "Station is offline — no capture possible."}
              </div>
              {error && <div className="text-xs text-red-400">{error}</div>}
            </div>
          ) : (
            <div
              className={`relative max-w-full ${controlling ? "cursor-crosshair" : ""}`}
              onMouseDown={onImgMouseDown}
              onMouseUp={onImgMouseUp}
              onWheel={onImgWheel}
            >
              <img
                ref={imgRef}
                src={`${imgUrl}?t=${encodeURIComponent(shotAt || Date.now())}`}
                alt={`${live.name} screen`}
                className="w-full h-auto max-h-[70vh] object-contain select-none"
                draggable={false}
              />
              {controlling && lastClick && (
                <div
                  className="absolute w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow pointer-events-none -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${(lastClick.x / lastClick.w) * 100}%`,
                    top: `${(lastClick.y / lastClick.h) * 100}%`,
                  }}
                />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-white/5">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" />
            {shotAt ? `Captured ${formatAge(age)}` : "Waiting for capture"}
            <span
              className={`ml-1 flex items-center gap-1 ${
                fresh ? "text-emerald-400" : "text-zinc-500"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${fresh ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`}
              />
              {fresh ? "refreshing every ~8s" : "refreshing…"}
            </span>
          </div>
          {imgUrl && (
            <a
              href={`${imgUrl}?t=${encodeURIComponent(shotAt || Date.now())}`}
              download={`${live.name}-screen.jpg`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/70 hover:bg-zinc-700/70 text-zinc-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Save
            </a>
          )}
        </div>

        {controlling && (
          <div className="flex flex-col gap-2 px-4 sm:px-5 py-3 border-t border-white/5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {["Enter", "Esc", "Tab", "Backspace", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].map((k) => (
                <button
                  key={k}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void sendEvent({ type: "key", key: k });
                  }}
                  className="px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 transition-colors"
                >
                  {k === "ArrowUp"
                    ? "↑"
                    : k === "ArrowDown"
                      ? "↓"
                      : k === "ArrowLeft"
                        ? "←"
                        : k === "ArrowRight"
                          ? "→"
                          : k === "Backspace"
                            ? "⌫"
                            : k}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-zinc-500 uppercase tracking-wide">
                click screen to control
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={controlText}
                onChange={(e) => setControlText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendText();
                }}
                placeholder="Type text, then press Enter…"
                className="flex-1 min-w-0 bg-zinc-800/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-pink-500/60"
              />
              <button
                onClick={sendText}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white transition-colors"
              >
                Send text
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRemainingShort(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatAge(age: number | null) {
  if (age === null) return "…";
  if (age < 5) return "just now";
  if (age < 60) return `${age}s ago`;
  return `${Math.floor(age / 60)}m ago`;
}

/* ============ SHARE TIME MODAL ============ */
function ShareModal({
  station,
  users,
  onClose,
  onDone,
}: {
  station: Station;
  users: User[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [targetName, setTargetName] = useState("");
  const [showList, setShowList] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const remaining = Math.floor(station.remaining_seconds / 60);

  const filtered = users
    .filter(
      (u) =>
        u.name.toLowerCase().includes(targetName.trim().toLowerCase()) &&
        u.name !== station.active?.user_name
    )
    .slice(0, 8);

  const share = async () => {
    if (!targetName.trim() || minutes <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_station: station.name,
          target_name: targetName.trim(),
          minutes,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setBusy(false);
        return;
      }
      if (data.target_session_seconds != null) {
        onDone(
          `${targetName.trim()} received ${minutes} min — added to their active session${data.target_station ? ` on ${data.target_station}` : ""} (${formatRemainingShort(data.target_session_seconds)} left).`
        );
      } else {
        onDone(
          `${targetName.trim()} received ${minutes} min as free time credit (${data.target_credit} min total).`
        );
      }
    } catch {
      setError("Cannot reach the server");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-md bg-[#0f1b2e] border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">
            Share Time — <span className="text-teal-400">{station.name}</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm text-zinc-400">
          Available to share:{" "}
          <span className="font-semibold text-emerald-400">
            {formatRemainingShort(station.remaining_seconds)}
          </span>
        </div>

        <div className="relative">
          <div className="text-sm text-zinc-400 mb-1">Player to receive</div>
          <input
            placeholder="Search player name…"
            value={targetName}
            onChange={(e) => {
              setTargetName(e.target.value);
              setShowList(true);
            }}
            onFocus={() => setShowList(true)}
            onBlur={() => setTimeout(() => setShowList(false), 150)}
            className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-white/5 rounded-xl text-sm placeholder-zinc-500 outline-none focus:border-teal-500/60"
          />
          {showList && filtered.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 max-h-44 overflow-y-auto bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl shadow-black/50">
              {filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setTargetName(u.name);
                    setShowList(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-sm text-zinc-200 hover:bg-teal-500/20 hover:text-white transition-colors truncate"
                >
                  {u.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-sm text-zinc-400 mb-1">Minutes to share</div>
          <div className="grid grid-cols-4 gap-2">
            {[15, 30, 60, 120].map((m) => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                disabled={m > remaining}
                className={`py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-30 ${
                  minutes === m
                    ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white"
                    : "bg-zinc-800/70 text-zinc-400 hover:text-white"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            max={Math.max(1, remaining)}
            placeholder="Custom minutes"
            value={minutes || ""}
            onChange={(e) => setMinutes(Math.min(remaining, Math.max(1, Number(e.target.value) || 0)))}
            className="w-full mt-2 px-3.5 py-2.5 bg-[#1e293b] border border-white/5 rounded-xl text-sm placeholder-zinc-500 outline-none focus:border-teal-500/60"
          />
        </div>

        {targetName.trim() && minutes > 0 && (
          <div className="text-xs text-teal-400 font-medium">
            {minutes} min → {targetName.trim()} (added to their session if
            they are playing now, otherwise saved as free time credit)
          </div>
        )}

        {error && <div className="text-xs text-red-400">{error}</div>}

        <button
          onClick={share}
          disabled={busy || !targetName.trim() || minutes <= 0}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-40 transition-all"
        >
          {busy ? (
            <span className="flex items-center justify-center gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin" /> Sharing…
            </span>
          ) : (
            "Share Time"
          )}
        </button>
        <button
          onClick={onClose}
          className="w-full py-2 text-sm text-zinc-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
