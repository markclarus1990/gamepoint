"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
type User = {
  name: string;
  points: number;
};

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [redeem, setRedeem] = useState(20);
  const [history, setHistory] = useState<any[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Load User
 useEffect(() => {
  const stored = localStorage.getItem("user");

  if (!stored) {
    // no user → redirect to login
    window.location.href = "/login";
    return;
  }

  const parsed = JSON.parse(stored);

  // OPTIONAL: re-fetch fresh data from DB using id
  const loadUser = async () => {
    const res = await fetch(`/api/user?id=${parsed.id}`);
    const data = await res.json();

    setUser(data);
  };

  loadUser();
}, []);
 
  // Load Session
  useEffect(() => {
  const loadHistory = async () => {
    if (!user) return;

    const res = await fetch(`/api/sessions?name=${user.name}`);
    const data = await res.json();
    setHistory(data);
  };

  loadHistory();
}, [user]);

 

  const requestRedeem = async () => {
    if (!user) return;

    if (redeem % 20 !== 0) {
      return alert("Must be multiple of 20");
    }

    if (redeem > user.points) {
      return alert("Not enough points");
    }

    await fetch("/api/redeem", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: user.name,
        points: redeem,
      }),
    });

    alert("Redeem request sent!");
  };

  if (!user) {
    return <div className="text-white p-6">Loading...</div>;
  }

  const pointsNeeded = Math.max(0, 20 - user.points);

const filteredHistory = history.filter((h) => {
  if (!fromDate && !toDate) return true;

  const d = new Date(h.created_at);

  if (fromDate && d < new Date(fromDate)) return false;

  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    if (d > end) return false;
  }

  return true;
});

const totalAmount = filteredHistory
  .filter(h => h.type !== "redeem") // 💰 only real money
  .reduce((sum, h) => sum + h.amount, 0);
const totalMinutes = filteredHistory.reduce((sum, h) => sum + h.minutes, 0);

const formatTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;

  if (h === 0) return `${m} mins`;
  if (m === 0) return `${h} hrs`;
  return `${h}h ${m}m`;
};

const convertPointsToMinutes = (points: number) => {
  const minutes =
    0.004666 * points * points -
    0.03333 * points +
    6.8;

  return Math.round(minutes);
};

const getMinutes = (h: any) => {
  if (h.type === "redeem") {
    return convertPointsToMinutes(h.amount); // ✅ always use formula
  }

  return h.minutes;
};
  // JSX
  return (
    <div className="min-h-screen bg-black text-white flex justify-center items-center">
      <div className="bg-gray-900 w-full max-w-md p-6 rounded-2xl space-y-6 shadow-lg">

        {/* HEADER */}
        <div className="flex items-center gap-4">

          {/* AVATAR */}
          <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-700">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                PIC
              </div>
            )}
          </div>

          {/* NAME + LABEL */}
          <div className="flex flex-col">
            <span className="text-xs text-gray-400">Player</span>
            <span className="text-lg font-semibold">{user.name}</span>
          </div>

        </div>

        {/* POINTS */}
        <div className="bg-gray-800 p-4 rounded-xl text-center text-lg">
          Available Points: <b>{user.points}</b>
        </div>

        {/* HISTORY */}
       {/* HISTORY */}
<div className="bg-gray-800 p-4 rounded-xl space-y-3">

  {/* FILTER BUTTONS */}
  <div className="flex gap-2">
    <button
      onClick={() => {
        const today = new Date().toISOString().split("T")[0];
        setFromDate(today);
        setToDate(today);
      }}
      className="bg-blue-600 px-2 py-1 rounded text-xs"
    >
      Today
    </button>

    <button
      onClick={() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        setFromDate(d.toISOString().split("T")[0]);
        setToDate(new Date().toISOString().split("T")[0]);
      }}
      className="bg-purple-600 px-2 py-1 rounded text-xs"
    >
      7 Days
    </button>

    <button
      onClick={() => {
        setFromDate("");
        setToDate("");
      }}
      className="bg-gray-700 px-2 py-1 rounded text-xs"
    >
      All
    </button>
  </div>

  {/* TOTALS */}
  <div className="bg-gray-700 p-3 rounded-lg text-sm">
    <div className="flex justify-between">
      <span>Total Spent</span>
      <span className="font-semibold">₱{totalAmount}</span>
    </div>
    <div className="flex justify-between mt-1">
      <span>Playtime</span>
      <span className="font-semibold">{formatTime(totalMinutes)}</span>
    </div>
  </div>

  {/* TITLE */}
  <div className="font-semibold">Session History</div>

  {/* LIST */}
  {filteredHistory.length === 0 ? (
    <div className="text-sm text-gray-400">
      No sessions for selected range
    </div>
  ) : (
   filteredHistory.map((h, i) => {
  const minutes = getMinutes(h);

  return (
    <div
      key={i}
      className="bg-gray-700 p-3 rounded-lg flex justify-between items-center"
    >
      <div>
        <div>
          {h.type === "redeem"
            ? `${h.amount} pts • ${minutes} mins`
            : `₱${h.amount} • ${minutes} mins`}
        </div>

        <div className="text-xs text-gray-400">
          {new Date(h.created_at).toLocaleString()}
        </div>
      </div>

      {/* ✅ FIXED BADGE */}
      {h.type === "redeem" && (
        <div
          className={`text-xs px-2 py-1 rounded ${
            h.status === "approved"
              ? "bg-purple-600"
              : "bg-yellow-600"
          }`}
        >
          {h.status === "approved" ? "Redeemed" : "Pending"}
        </div>
      )}
    </div>
  );
})
  )}

</div>
        {/* REDEEM */}
        <div className="space-y-3">
          <div className="text-sm text-gray-400">
            Enter Points to Redeem
          </div>

          <input
            type="number"
            value={redeem}
            disabled={user.points < 20}
          onChange={(e) => {
            let val = Number(e.target.value);

            if (isNaN(val) || val < 0) val = 0;

            setRedeem(val);
          }}
            className={`w-full p-3 rounded ${
              user.points < 20
                ? "bg-gray-700 cursor-not-allowed"
                : "bg-gray-800"
            }`}
          />

          <div className="text-xs text-gray-400">
            {user.points < 20
              ? `You need ${pointsNeeded} more points`
              : "Must be multiple of 20"}
          </div>

      <button
  disabled={
    user.points < 20 ||
    redeem < 20 ||
    redeem > user.points
  }
  onClick={requestRedeem}   // 👈 THIS IS MISSING
  className="w-full p-3 rounded-lg font-semibold bg-purple-600"
>
  Request to Redeem
</button>
        </div>

      </div>
    </div>
  );
}