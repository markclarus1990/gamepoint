"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

type User = {
  id: string;
  name: string;
  points: number;
  reserved_points?: number;
  gfunds?: number;
  avatar_url?: string;
};

type ActiveSession = {
  id: string;
  station_name?: string;
  user_name: string;
  minutes: number;
  payment_method?: string;
  ends_at?: string;
};

type StationInfo = {
  id: string;
  name: string;
  online: boolean;
  active: ActiveSession | null;
};

type HistoryEntry = {
  type?: string;
  status?: string;
  station_name?: string;
  payment_method?: string;
  points_used?: number;
  gfunds_used?: number;
  amount?: number;
  minutes?: number;
  created_at?: string;
};

const POINTS_PER_REDEEM = 20;
const MINUTES_PER_POINT_REDEEM = 8;
const MINUTES_PER_PESO = 4;

function formatClock(totalSeconds: number) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return hrs > 0
    ? `${hrs}:${String(mins).padStart(2, "0")}:${ss}`
    : `${mm}:${ss}`;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [active, setActive] = useState<ActiveSession | null>(null);
  const [remaining, setRemaining] = useState(0);

  const [payment, setPayment] = useState<"points" | "gfunds">("points");
  const [amountInput, setAmountInput] = useState("");
  const [stations, setStations] = useState<StationInfo[]>([]);
  const [stationName, setStationName] = useState("");
  const [stationDetected, setStationDetected] = useState(false);
  const [starting, setStarting] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadUser = async (id: string) => {
    const res = await fetch(`/api/user?id=${id}`);
    const data = await res.json();
    setUser(data.user);
    setHistory(data.history || []);
    return data.user as User;
  };

  const loadActive = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/active?id=${id}`);
      const data = await res.json();
      setActive(data.session || null);
      setRemaining(data.remaining_seconds || 0);
    } catch {
      // ignore poll errors
    }
  };

  const loadStations = async () => {
    try {
      const res = await fetch("/api/stations");
      const data = await res.json();
      setStations(data.stations || []);
    } catch {
      setStations([]);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      window.location.href = "/login";
      return;
    }

    const parsed = JSON.parse(stored);

    const init = async () => {
      await loadUser(parsed.id);
      await loadActive(parsed.id);
      await loadStations();
      setLoading(false);

      try {
        const res = await fetch("http://localhost:3987/station", {
          signal: AbortSignal.timeout(1500),
        });
        const data = await res.json();
        if (data?.station_name) {
          setStationName(data.station_name);
          setStationDetected(true);
        }
      } catch {
        // agent not running on this machine — fall back to manual pick
      }
    };

    init();

    tickRef.current = setInterval(() => {
      loadActive(parsed.id);
      loadStations();
    }, 15000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutesFromInput = (() => {
    const value = Number(amountInput);
    if (!value || value <= 0) return 0;
    return payment === "points"
      ? Math.floor(value / POINTS_PER_REDEEM) * MINUTES_PER_POINT_REDEEM
      : value * MINUTES_PER_PESO;
  })();

  const canStart = (() => {
    if (!user || !stationName || starting) return false;
    const value = Number(amountInput);
    if (!value || value <= 0) return false;
    if (payment === "points") {
      if (value % POINTS_PER_REDEEM !== 0) return false;
      return value <= (user.points || 0) - (user.reserved_points || 0);
    }
    return value <= (user.gfunds || 0);
  })();

  const startSession = async () => {
    if (!user || !stationName) return;

    setStarting(true);
    try {
      const res = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          station_name: stationName,
          payment,
          points: payment === "points" ? Number(amountInput) : undefined,
          gfunds: payment === "gfunds" ? Number(amountInput) : undefined,
        }),
      });

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success(
        `Session started on ${stationName} — ${data.remaining_seconds / 60} minutes`
      );
      setAmountInput("");
      await loadUser(user.id);
      await loadActive(user.id);
      await loadStations();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return <div className="text-white p-10">Loading...</div>;
  }

  const availablePoints = (user?.points || 0) - (user?.reserved_points || 0);
  const gfunds = user?.gfunds || 0;

  return (
    <div className="min-h-screen bg-black text-white flex justify-center items-center">
      <div className="bg-gray-900 w-full max-w-md p-6 rounded-2xl space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-700 flex items-center justify-center">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                "Player"
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400">Player</div>
              <div className="text-lg font-semibold">{user?.name}</div>
            </div>
          </div>
        </div>

        {/* BALANCES */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800 p-4 rounded-xl text-center">
            <div className="text-xs text-gray-400">Gfunds</div>
            <div className="text-xl font-bold text-green-400">₱{gfunds}</div>
            <div className="text-[10px] text-gray-500">1₱ = 4 mins</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl text-center">
            <div className="text-xs text-gray-400">Gamepoints</div>
            <div className="text-xl font-bold text-purple-400">
              {availablePoints}
              {user?.reserved_points ? (
                <span className="text-xs text-gray-500">
                  {" "}
                  ({user.reserved_points} reserved)
                </span>
              ) : null}
            </div>
            <div className="text-[10px] text-gray-500">20 pts = 8 mins</div>
          </div>
        </div>

        {/* ACTIVE SESSION */}
        {active && active.ends_at && (
          <div className="bg-green-900/40 border border-green-600 p-4 rounded-xl">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-green-300">
                  Active session — {active.station_name}
                </div>
                <div className="text-3xl font-black text-green-400 tabular-nums">
                  {formatClock(remaining)}
                </div>
              </div>
              <div className="text-right text-xs text-green-200">
                <div>ends {new Date(active.ends_at).toLocaleTimeString()}</div>
              </div>
            </div>
          </div>
        )}

        {/* START SESSION */}
        <div className="bg-gray-800 p-4 rounded-xl space-y-4">
          <div className="font-semibold">
            {active ? "Extend Session" : "Start Session"}
          </div>

          {/* PAYMENT TOGGLE */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPayment("points")}
              className={`p-2 rounded-lg text-sm font-semibold ${
                payment === "points"
                  ? "bg-purple-600"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              Gamepoints
            </button>
            <button
              onClick={() => setPayment("gfunds")}
              className={`p-2 rounded-lg text-sm font-semibold ${
                payment === "gfunds"
                  ? "bg-green-600"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              Gfunds
            </button>
          </div>

          {/* STATION */}
          <div>
            <div className="text-xs text-gray-400 mb-1">
              {stationDetected ? "Detected PC" : "Select PC"}
            </div>
            <select
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              className="w-full p-2 rounded bg-gray-700"
            >
              <option value="">{stationDetected ? "Loading PC..." : "Select a PC..."}</option>
              {stations.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                  {s.active ? " (occupied)" : s.online ? " (online)" : " (offline)"}
                </option>
              ))}
            </select>
          </div>

          {/* AMOUNT */}
          <div>
            <div className="text-xs text-gray-400 mb-1">
              {payment === "points"
                ? `Enter points (multiple of ${POINTS_PER_REDEEM})`
                : "Enter amount in pesos"}
            </div>
            <input
              type="number"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full p-2 rounded bg-gray-700"
              placeholder={payment === "points" ? "20" : "10"}
            />
            <div className="text-xs text-gray-400 mt-1">
              Time: {minutesFromInput} mins
            </div>
            {payment === "points" && amountInput && Number(amountInput) % POINTS_PER_REDEEM !== 0 && (
              <div className="text-xs text-red-400 mt-1">
                Must be a multiple of {POINTS_PER_REDEEM}
              </div>
            )}
          </div>

          <button
            onClick={startSession}
            disabled={!canStart}
            className={`w-full p-3 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${
              payment === "points"
                ? "bg-purple-600 hover:bg-purple-500"
                : "bg-green-600 hover:bg-green-500"
            }`}
          >
            {starting
              ? "Starting..."
              : active
                ? `Extend +${Math.floor(minutesFromInput)} mins`
                : `Start ${minutesFromInput} mins`}
          </button>
        </div>

        {/* HISTORY */}
        <div className="bg-gray-800 p-4 rounded-xl space-y-3">
          <div className="flex justify-between">
            <div className="font-semibold">Session History</div>
            <div className="text-xs text-gray-400">
              {history.reduce((s, h) => s + (h.minutes || 0), 0)} mins total
            </div>
          </div>

          {history.length === 0 ? (
            <div className="text-sm text-gray-400">No sessions yet</div>
          ) : (
            history.slice(0, 15).map((h, i) => (
              <div key={i} className="bg-gray-700 p-3 rounded-lg flex justify-between">
                <div>
                  <div>
                    {h.payment_method === "points"
                      ? `${h.points_used ?? h.amount} pts • ${h.minutes} mins`
                      : h.payment_method === "gfunds"
                        ? `₱${h.gfunds_used ?? h.amount} • ${h.minutes} mins`
                        : h.type === "redeem"
                          ? `${h.amount} pts • ${h.minutes} mins`
                          : `₱${h.amount} • ${h.minutes} mins`}
                    {h.station_name ? (
                      <span className="text-xs text-gray-400 ml-1">
                        ({h.station_name})
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-400">
                    {h.created_at ? new Date(h.created_at).toLocaleString() : ""}
                  </div>
                </div>
                {h.type === "redeem" && (
                  <div className="text-xs px-2 py-1 rounded bg-purple-600">
                    {h.status === "approved" ? "Redeemed" : "Pending"}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
