"use client";

import { useState, useEffect } from "react";

export default function ChangePassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // ✅ Load user from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const handleChange = async () => {
    if (!password) return alert("Enter new PIN");
    if (!user) return alert("User not found");

    setLoading(true);

    const res = await fetch("/api/change-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: user.id,
        pin: password,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.error) {
      alert(data.error);
    } else {
      alert("PIN updated!");
      window.location.href = "/";
    }
  };

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl mb-4 font-semibold">Change PIN</h1>

      <input
        type="password"
        placeholder="New PIN"
        className="border border-gray-600 p-2 w-full mb-3 rounded bg-transparent"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleChange}
        disabled={loading}
        className="w-full bg-blue-600 py-2 rounded text-white"
      >
        {loading ? "Saving..." : "Save PIN"}
      </button>
    </div>
  );
}