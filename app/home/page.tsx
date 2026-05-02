"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
export default function Home() {
  type HistoryItem = {
  id: string;
  type: "session" | "redeem";
  amount: number;
  minutes: number;
  created_at: string;
  status?: string;
};
  const [user, setUser] = useState(null);
const [history, setHistory] = useState<any[]>([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [redeem, setRedeem] = useState(20);
  const [loading, setLoading] = useState(true);

  // LOAD USER
  useEffect(() => {
    const stored = localStorage.getItem("user");

    if (!stored) {
      window.location.href = "/login";
      return;
    }

    const parsed = JSON.parse(stored);

    const loadUser = async () => {
      const res = await fetch(`/api/user?id=${parsed.id}`);
      const data = await res.json();

      setUser(data.user);
      setHistory(data.history || []);
      setLoading(false);
    };

    loadUser();
  }, []);

  // FILTER (NO TIMEZONE BUG)
  const filteredHistory = (history || []).filter((h) => {
    if (!fromDate && !toDate) return true;
    if (!h.created_at) return true;

    const itemDate = h.created_at.slice(0, 10);

    return (
      (!fromDate || itemDate >= fromDate) &&
      (!toDate || itemDate <= toDate)
    );
  });

  // TOTALS
  const totalAmount = filteredHistory.reduce(
    (sum, h) => sum + (h.amount || 0),
    0
  );

  const totalMinutes = filteredHistory.reduce(
    (sum, h) => sum + (h.minutes || 0),
    0
  );

 const formatTime = (mins) => {
  if (!mins) return "0 mins";

  const hrs = Math.floor(mins / 60);
  const remaining = mins % 60;

  if (hrs > 0 && remaining > 0) {
    return `${hrs} hr${hrs > 1 ? "s" : ""} ${remaining} min${remaining > 1 ? "s" : ""}`;
  }

  if (hrs > 0) {
    return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  }

  return `${remaining} min${remaining > 1 ? "s" : ""}`;
};

  // REDEEM
 const requestRedeem = async () => {
  console.log("REDEEM START");

  try {
    const stored = JSON.parse(localStorage.getItem("user")!);

    console.log("USER:", stored);

    const res = await fetch("/api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: stored.id,
        points: redeem,
      }),
    });

    console.log("FETCH DONE");

    const data = await res.json();

    console.log("REDEEM RESPONSE:", data);

    const refresh = await fetch(`/api/user?id=${stored.id}`);
    const refreshed = await refresh.json();

    setUser(refreshed.user);
    setHistory(refreshed.history || []);
      toast.success("Redeem request sent!");
  } catch (err) {
    console.error("REDEEM ERROR:", err);
  }
};
  // CHANGE AVATAR
  const changeAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

   const stored = JSON.parse(localStorage.getItem("user")!);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", stored.id);

    const res = await fetch("/api/update-avatar", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    setUser((prev) => ({
      ...prev,
      avatar_url: data.url,
    }));
  };

  // LOGOUT
  const logout = () => {
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  if (loading) {
    return <div className="text-white p-10">Loading...</div>;
  }
console.log("redeem:", redeem);
console.log("points:", user?.points);

  return (
    <div className="min-h-screen bg-black text-white flex justify-center items-center">
      <div className="bg-gray-900 w-full max-w-md p-6 rounded-2xl space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">

            {/* AVATAR */}
            <label className="cursor-pointer">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-700 flex items-center justify-center">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  "Change Avatar"
                )}
              </div>
              <input type="file" hidden onChange={changeAvatar} />
            </label>

            <div>
              <div className="text-xs text-gray-400">Player</div>
              <div className="text-lg font-semibold">{user?.name}</div>
            </div>
          </div>
<button
  onClick={() => (window.location.href = "/change-password")}
  className="bg-yellow-500 px-3 py-1 rounded text-sm"
>
  Change PIN
</button>
          <button
            onClick={logout}
            className="text-xs bg-red-600 px-3 py-1 rounded"
          >
            Logout
          </button>


        </div>

        {/* POINTS */}
        <div className="bg-gray-800 p-4 rounded-xl text-center text-lg">
          Available Points: <b>{user?.points || 0}</b>
        </div>

        {/* FILTER */}
        <div className="bg-gray-800 p-4 rounded-xl space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                const today = new Date();
                const f = `${today.getFullYear()}-${String(
                  today.getMonth() + 1
                ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                setFromDate(f);
                setToDate(f);
              }}
              className="bg-blue-600 px-2 py-1 rounded text-xs"
            >
              Today
            </button>

            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 7);

                const from = `${d.getFullYear()}-${String(
                  d.getMonth() + 1
                ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

                const today = new Date();
                const to = `${today.getFullYear()}-${String(
                  today.getMonth() + 1
                ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

                setFromDate(from);
                setToDate(to);
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
              <span>₱{totalAmount}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Playtime</span>
              <span>{formatTime(totalMinutes)}</span>
            </div>
          </div>

          {/* HISTORY */}
          <div className="font-semibold">Session History</div>

          {filteredHistory.length === 0 ? (
            <div className="text-sm text-gray-400">No sessions yet</div>
          ) : (
            filteredHistory.map((h, i) => (
              <div
                key={i}
                className="bg-gray-700 p-3 rounded-lg flex justify-between"
              >
                <div>
                  <div>
                    {h.type === "redeem"
                      ? `${h.amount} pts • ${h.minutes} mins`
                      : `₱${h.amount} • ${h.minutes} mins`}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(h.created_at).toLocaleString()}
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

        {/* REDEEM */}
        <div className="space-y-3">
          <div className="text-sm text-gray-400">
            Enter Points to Redeem
          </div>

          <input
            type="number"
            value={redeem}
            onChange={(e) => setRedeem(Number(e.target.value))}
            className="w-full p-3 rounded bg-gray-800"
          />

          <div className="text-xs text-gray-400">
            {user.points < 20
              ? `You need ${20 - user.points} more points`
              : "Must be multiple of 20"}
          </div>

<button
  onClick={() => {
    console.log("CLICKED REDEEM");
    requestRedeem();
  }}
  className="w-full p-3 rounded-lg bg-purple-600"
>
  REQUEST REDEEM
</button>
        </div>

      </div>
    </div>
  );
}