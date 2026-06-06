"use client";
import { useState, useEffect } from "react";

type User = {
    id: string;
  name: string;
  points: number;
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
export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pending, setPending] = useState<Redeem[]>([]);
  const [authorized, setAuthorized] = useState(false);
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

useEffect(() => {
  loadPending();
}, []);

  useEffect(() => {
    loadUsers();
  }, []);

const openHistory = (user: User) => {
  setSelectedUser(user);
  loadSessions(user.id);
};

  const addSession = async () => {
    if (!selectedUser || amount <= 0) return;

    const minutes = amount * 4;
    const points = amount;

    await fetch("/api/add-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: selectedUser.name,
        amount,
        minutes,
        points,
      }),
    });

    setShowModal(false);
    setAmount(0);
    loadUsers();
    loadSessions(selectedUser.name);
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
    <div className="min-h-screen bg-black text-white p-6 flex gap-6">
<div className="bg-gray-900 p-4 rounded-xl">
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
        await fetch("/api/redeem/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: r.id }),
        });

        loadPending();
        // loadData();
      }}
      className="bg-green-600 px-3 py-1 rounded"
    >
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

              <span>{u.name}</span>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedUser(u);
                    setShowModal(true);
                  }}
                  className="bg-green-600 px-2 py-1 rounded text-sm"
                >
                  Add Session
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

      {/* MODAL */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center">

          <div className="bg-gray-900 p-6 rounded-xl space-y-4 w-80">

            <h2 className="font-semibold">
              Add Session - {selectedUser.name}
            </h2>

            <input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full p-2 bg-gray-800 rounded"
            />

            <div className="text-sm text-gray-400">
              Time: {amount * 4} mins
            </div>

            <button
              onClick={addSession}
              className="w-full bg-green-600 p-2 rounded"
            >
              Confirm
            </button>

            <button
              onClick={() => setShowModal(false)}
              className="w-full text-gray-400"
            >
              Cancel
            </button>

          </div>

        </div>
      )}

    </div>
  );
}