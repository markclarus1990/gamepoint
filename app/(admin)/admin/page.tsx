"use client";
import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

type User = {
    id: string;
  name: string;
  points: number;
  gfunds?: number;
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
  users?: {
    name: string;
  };
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
};
export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [deductAmount, setDeductAmount] = useState(0);
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const isAdmin = localStorage.getItem("isAdmin");

    if (isAdmin !== "true") {
      window.location.href = "/login";
    } else {
      setAuthorized(true);
    }
  }, []);
  
    // Load Users
  const loadUsers = async () => {
    const res = await fetch("/api/users");
    setUsers(await res.json());
  };

const loadSessions = async (id: string) => {
  const res = await fetch(`/api/sessions?id=${id}`);
  const data = await res.json();

  setSessions(data.history || []);
};
//   Load Pending Request
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
};

  const deductPoints = async () => {
    if (!selectedUser || deductAmount <= 0) return;

    await fetch("/api/deduct-points", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: selectedUser.name,
        points: deductAmount,
      }),
    });

    setShowDeductModal(false);
    setDeductAmount(0);
    loadUsers();
    loadSessions(selectedUser.id);
  };

  const loadAccount = async () => {
    if (!selectedUser || (loadGfunds <= 0 && loadPoints <= 0)) return;

    const res = await fetch("/api/admin/load", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: selectedUser.id,
        gfunds: loadGfunds,
        points: loadPoints,
      }),
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    setShowModal(false);
    setLoadGfunds(0);
    setLoadPoints(0);
    loadUsers();
  };

  const addStation = async () => {
    if (!newStationName.trim()) return;

    const res = await fetch("/api/stations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newStationName.trim() }),
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    setNewStationName("");
    loadStations();
    alert(`Station "${data.station.name}" added!\n\nAgent key: ${data.station.agent_key}\n\nPaste this key in the PC agent's config file.`);
  };

  const deleteStation = async (id: string) => {
    if (!confirm("Delete this station?")) return;
    await fetch(`/api/stations/${id}`, { method: "DELETE" });
    loadStations();
  };

  const endStationSession = async (name: string) => {
    if (!confirm(`End the active session on ${name}? The PC will lock.`)) return;
    await fetch("/api/sessions/end", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ station_name: name }),
    });
    loadStations();
  };

  const openStationTime = async () => {
    if (!openStation || openMinutes <= 0) return;

    const res = await fetch("/api/sessions/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        station_name: openStation.name,
        minutes: openMinutes,
      }),
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    setOpenStation(null);
    setOpenPesos(0);
    setOpenMinutes(0);
    loadStations();
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
    } catch {
      prompt("Copy the agent key:", key);
    }
  };

  const formatRemaining = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}h ${m}m`
      : `${m}m ${s}s`;
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

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
        <button
          onClick={() => (window.location.href = "/admin/chat")}
          className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Messages
        </button>
      </div>
      <div className="flex gap-6">
<div className="bg-gray-900 p-4 rounded-xl min-w-[280px]">
  <h2 className="font-semibold mb-3">Redeem Requests</h2>

  {pending.length === 0 ? (
    <div className="text-gray-400">No pending requests</div>
  ) : (
   pending.map((r) => (
  <div key={r.id} className="bg-gray-800 p-3 rounded-lg mb-2 flex justify-between items-center">
    
    <div>
      <div className="font-semibold">
        {r.users?.name || "Unknown"}
      </div>

      <div className="text-sm text-gray-400">
        {r.points_used} pts • {r.minutes} mins
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
      className="bg-green-600 px-3 py-1 rounded flex items-center gap-1 disabled:opacity-60"
    >
      {grantingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
      Grant
    </button>

  </div>
))
  )}
</div>

<div className="bg-gray-900 p-4 rounded-xl min-w-[280px]">
  <h2 className="font-semibold mb-3">Shop Orders</h2>

  {shopOrders.length === 0 ? (
    <div className="text-gray-400">No pending orders</div>
  ) : (
   shopOrders.map((o) => (
  <div key={o.id} className="bg-gray-800 p-3 rounded-lg mb-2 flex justify-between items-center">
    
    <div>
      <div className="font-semibold">
        {o.users?.name || "Unknown"}
      </div>

      <div className="text-sm text-gray-400">
        {o.products?.name || "Unknown item"} • {o.points_spent} pts
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
      className="bg-green-600 px-3 py-1 rounded flex items-center gap-1 disabled:opacity-60"
    >
      {shopGrantingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
      Grant
    </button>

  </div>
))
  )}
</div>
      {/* LEFT PANEL */}
      <div className="w-1/2 space-y-4">

        <input
          placeholder="Search user..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-2 bg-gray-800 rounded"
        />

        <div className="bg-gray-900 p-4 rounded-xl space-y-2">
          <h2 className="font-semibold">Users</h2>

          {filteredUsers.map((u, i) => (
            <div key={i} className="flex justify-between items-center bg-gray-800 p-2 rounded">

              <div>
              <div>{u.name}</div>
              <div className="text-xs text-yellow-400">
                ₱{u.gfunds || 0} • {u.points || 0} pts
              </div>
            </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedUser(u);
                    setShowModal(true);
                  }}
                  className="bg-green-600 px-2 py-1 rounded text-sm"
                >
                  Load
                </button>

                <button
                  onClick={() => {
                    setSelectedUser(u);
                    setShowDeductModal(true);
                  }}
                  className="bg-red-600 px-2 py-1 rounded text-sm"
                >
                  Deduct
                </button>

                <button
                  onClick={() => openHistory(u)}
                  className="bg-blue-600 px-2 py-1 rounded text-sm"
                >
                  History
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
    <div className="w-1/2 bg-gray-900 p-4 rounded-xl overflow-y-auto max-h-[80vh]">
<div className="flex gap-2 mb-3">

  <input
    type="date"
    value={fromDate}
    onChange={(e) => setFromDate(e.target.value)}
    className="bg-gray-800 p-2 rounded text-sm"
  />

  <input
    type="date"
    value={toDate}
    onChange={(e) => setToDate(e.target.value)}
    className="bg-gray-800 p-2 rounded text-sm"
  />

  <button
    onClick={() => {
      const today = new Date().toISOString().split("T")[0];
      setFromDate(today);
      setToDate(today);
    }}
    className="bg-blue-600 px-3 rounded text-sm"
  >
    Today
  </button>

  <button
    onClick={() => {
      setFromDate("");
      setToDate("");
    }}
    className="bg-gray-700 px-3 rounded text-sm"
  >
    Clear
  </button>

</div>
  <h2 className="font-semibold mb-3">
    {selectedUser ? `${selectedUser.name} History` : "Select a user"}
  </h2>

  {!selectedUser ? (
    <div className="text-gray-400">No user selected</div>
  ) : sessions.length === 0 ? (
    <div className="text-gray-400">No history</div>
  ) : (
    (() => {
      // ✅ group sessions by date
      const groups: Record<string, typeof sessions> = {};

      filteredSessions.forEach((s) => {
        const date = new Date(s.created_at).toDateString();
        if (!groups[date]) groups[date] = [];
        groups[date].push(s);
      });

      return Object.entries(groups).map(([date, items]) => {
        const today = new Date().toDateString();
        const label = date === today ? "Today" : date;

        const totalMinutes = items.reduce((sum, s) => sum + s.minutes, 0);
        const totalAmount = items.reduce((sum, s) => sum + s.amount, 0);

        return (
          <div key={date} className="mb-4">

            {/* DATE HEADER */}
            <div className="text-sm text-gray-400 mb-2">
              {label}
            </div>

            {/* SESSIONS */}
            <div className="space-y-2">
              {items.map((s, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center bg-gray-800 p-2 rounded"
                >
                  <div>
                    <div className="text-sm">
                      ₱{s.amount} • {s.minutes} mins
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(s.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* TOTAL */}
            <div className="text-xs text-purple-400 mt-2 flex justify-between">
              <span>Total: {totalMinutes} mins</span>
              <span>₱{totalAmount}</span>
            </div>

          </div>
        );
      });
    })()
  )}

</div>

      {/* DEDUCT MODAL */}
      {showDeductModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="bg-gray-900 p-6 rounded-xl space-y-4 w-80">
            <h2 className="font-semibold">
              Deduct Points - {selectedUser.name}
            </h2>

            <div className="text-sm text-gray-400">
              Current points: {selectedUser.points || 0}
            </div>

            <input
              type="number"
              placeholder="Enter points to deduct"
              value={deductAmount}
              onChange={(e) => setDeductAmount(Number(e.target.value))}
              className="w-full p-2 bg-gray-800 rounded"
            />

            <button
              onClick={deductPoints}
              className="w-full bg-red-600 p-2 rounded"
            >
              Confirm Deduct
            </button>

            <button
              onClick={() => {
                setShowDeductModal(false);
                setDeductAmount(0);
              }}
              className="w-full text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MODAL */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center">

          <div className="bg-gray-900 p-6 rounded-xl space-y-4 w-80">

            <h2 className="font-semibold">
              Load Account - {selectedUser.name}
            </h2>

            <div className="text-sm text-gray-400">
              Current: ₱{selectedUser.gfunds || 0} gfunds • {selectedUser.points || 0} pts
            </div>

            <div>
              <input
                type="number"
                placeholder="Gfunds (pesos)"
                value={loadGfunds}
                onChange={(e) => setLoadGfunds(Number(e.target.value))}
                className="w-full p-2 bg-gray-800 rounded"
              />
              <div className="text-xs text-gray-400 mt-1">
                1₱ = 4 mins of gfunds time
              </div>
            </div>

            <div>
              <input
                type="number"
                placeholder="Bonus gamepoints"
                value={loadPoints}
                onChange={(e) => setLoadPoints(Number(e.target.value))}
                className="w-full p-2 bg-gray-800 rounded"
              />
              <div className="text-xs text-gray-400 mt-1">
                20 pts = 8 mins of game time
              </div>
            </div>

            <button
              onClick={loadAccount}
              className="w-full bg-green-600 p-2 rounded"
            >
              Load
            </button>

            <button
              onClick={() => {
                setShowModal(false);
                setLoadGfunds(0);
                setLoadPoints(0);
              }}
              className="w-full text-gray-400"
            >
              Cancel
            </button>

          </div>

        </div>
      )}

      {/* OPEN TIME MODAL */}
      {openStation && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="bg-gray-900 p-6 rounded-xl space-y-4 w-80">
            <h2 className="font-semibold">Open Time - {openStation.name}</h2>

            <div>
              <div className="text-sm text-gray-400 mb-1">Amount paid (₱)</div>
              <input
                type="number"
                value={openPesos}
                onChange={(e) => {
                  const p = Number(e.target.value);
                  setOpenPesos(p);
                  setOpenMinutes(p * 4);
                }}
                className="w-full p-2 bg-gray-800 rounded"
                placeholder="0"
              />
            </div>

            <div>
              <div className="text-sm text-gray-400 mb-1">Minutes</div>
              <input
                type="number"
                value={openMinutes}
                onChange={(e) => setOpenMinutes(Number(e.target.value))}
                className="w-full p-2 bg-gray-800 rounded"
              />
            </div>

            <div className="flex gap-2">
              {[15, 30, 60, 120].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setOpenMinutes(m);
                    setOpenPesos(m / 4);
                  }}
                  className="flex-1 bg-gray-700 px-2 py-1 rounded text-xs"
                >
                  {m}m
                </button>
              ))}
            </div>

            <button
              onClick={openStationTime}
              disabled={openMinutes <= 0}
              className="w-full bg-green-600 p-2 rounded disabled:opacity-40"
            >
              Open {openMinutes > 0 ? `${openMinutes} mins` : "Time"}
            </button>

            <button
              onClick={() => {
                setOpenStation(null);
                setOpenPesos(0);
                setOpenMinutes(0);
              }}
              className="w-full text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* STATIONS PANEL */}
      <div className="mt-6 bg-gray-900 p-4 rounded-xl">
        <h2 className="font-semibold mb-3">Stations (PCs)</h2>

        <div className="flex gap-2 mb-4">
          <input
            placeholder="PC name (e.g. PC-1)"
            value={newStationName}
            onChange={(e) => setNewStationName(e.target.value)}
            className="flex-1 p-2 bg-gray-800 rounded"
          />
          <button
            onClick={addStation}
            className="bg-purple-600 px-4 rounded"
          >
            Add PC
          </button>
        </div>

        {stations.length === 0 ? (
          <div className="text-gray-400 text-sm">
            No stations yet. Add a PC above, then install the agent on it.
          </div>
        ) : (
          <div className="space-y-2">
            {stations.map((s) => (
              <div
                key={s.id}
                className="flex justify-between items-center bg-gray-800 p-3 rounded"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      s.active
                        ? "bg-green-500"
                        : s.online
                          ? "bg-yellow-400"
                          : "bg-gray-600"
                    }`}
                  />
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    {s.active ? (
                      <div className="text-xs text-green-400">
                        {s.active.user_name} • {formatRemaining(s.remaining_seconds)} left
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">
                        {s.online ? "Online" : "Offline"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyKey(s.agent_key)}
                    className="text-xs bg-gray-700 px-2 py-1 rounded"
                    title="Copy agent key"
                  >
                    {copiedKey === s.agent_key ? "Copied!" : "Key"}
                  </button>

                  {!s.active && (
                    <button
                      onClick={() => {
                        setOpenStation(s);
                        setOpenPesos(0);
                        setOpenMinutes(0);
                      }}
                      className="text-xs bg-green-600 px-2 py-1 rounded"
                    >
                      Open Time
                    </button>
                  )}

                  {s.active && (
                    <button
                      onClick={() => endStationSession(s.name)}
                      className="text-xs bg-red-600 px-2 py-1 rounded"
                    >
                      End
                    </button>
                  )}

                  <button
                    onClick={() => deleteStation(s.id)}
                    className="text-xs bg-gray-700 px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>
    </div>
  );
}