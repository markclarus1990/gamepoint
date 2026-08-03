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
} from "lucide-react";

type User = {
  id: string;
  name: string;
  points: number;
  gfunds?: number;
  time_credit_minutes?: number;
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

type Tab = "stations" | "requests" | "shop" | "users" | "history";

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
  const [pending, setPending] = useState<Redeem[]>([]);
  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([]);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [shopGrantingId, setShopGrantingId] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<Tab>("stations");
  const [viewStation, setViewStation] = useState<Station | null>(null);
  const [shareStation, setShareStation] = useState<Station | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
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

  const openHistory = (user: User) => {
    setSelectedUser(user);
    loadSessions(user.id);
    setTab("history");
  };

  const deductPoints = async () => {
    if (!selectedUser || deductAmount <= 0) return;
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
  };

  const loadAccount = async () => {
    if (!selectedUser || (loadGfunds <= 0 && loadPoints <= 0)) return;
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
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
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
              disabled={deductAmount <= 0}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-colors"
            >
              Confirm Deduct
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
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all"
            >
              Load
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
