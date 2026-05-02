"use client";

import { useState } from "react";

export default function Login() {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!name || !pin) return alert("Enter name and PIN");

    setLoading(true);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, pin }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.error) {
      alert(data.error);
    } else {
      localStorage.setItem("user", JSON.stringify(data));
      console.log("LOGIN DATA:", data);
      window.location.href = "/home";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] px-4">

      {/* CENTER WRAPPER */}
      <div className="w-full max-w-sm">

        {/* CARD */}
        <div className="bg-[#0f1b2e] border border-gray-800 rounded-2xl p-6 shadow-xl">

          <h1 className="text-center text-white text-xl font-semibold mb-6">
            Player Login
          </h1>

          <div className="space-y-4">

            <input
              placeholder="Player Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#1e293b] border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <input
              type="password"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#1e293b] border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full mt-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 active:scale-[0.98] transition"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
<p className="text-center text-gray-400 text-sm mt-4">
  No account?{" "}
  <a href="/register" className="text-purple-400 hover:underline">
    Register
  </a>
</p>
        </div>
      </div>
    </div>
  );
}