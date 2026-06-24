"use client";

import { useState } from "react";

export default function Register() {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !pin) return alert("Enter name and PIN");

    setLoading(true);

    const res = await fetch("/api/register", {
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
      alert("Account created!");
      window.location.href = "/login";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] px-4">

      <div className="w-full max-w-sm">
        <div className="bg-[#0f1b2e] border border-gray-800 rounded-2xl p-6 shadow-xl">

          <h1 className="text-center text-white text-xl font-semibold mb-6">
            Create Account
          </h1>

          <div className="space-y-4">

            <input
              placeholder="Player Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#1e293b] border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <input
              type="password"
              placeholder="PIN (4 digits)"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#1e293b] border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

          </div>

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full mt-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-500"
          >
            {loading ? "Creating..." : "Register"}
          </button>

          {/* LINK BACK */}
          <p className="text-center text-gray-400 text-sm mt-4">
            Already have an account?{" "}
            <a href="/login" className="text-purple-400 hover:underline">
              Login
            </a>
          </p>

        </div>
      </div>
    </div>
  );
}