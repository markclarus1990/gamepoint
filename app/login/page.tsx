"use client";

import { useState } from "react";

export default function Login() {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

 const handleLogin = async () => {
  if (!name || !pin) return alert("Enter name and PIN");

  // ADMIN LOGIN
  if (name === "admin" && pin === "madmin") {
    localStorage.setItem("isAdmin", "true");
    window.location.href = "/admin";
    return;
  }

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

    localStorage.setItem("isAdmin", "false");
    localStorage.setItem("user", JSON.stringify(data));

    console.log("LOGIN DATA:", data);

    window.location.href = "/home";
  }
};

  return (
<div
  className="min-h-screen flex items-center justify-center bg-cover bg-center px-4 relative overflow-hidden"
  style={{
    backgroundImage: "url('/bg.png')",
  }}
>

  {/* OVERLAY */}
  <div className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"></div>

  {/* CENTER WRAPPER */}
  <div className="relative z-10 w-full max-w-sm">

    {/* LOGO/TITLE */}
    <div className="text-center mb-6">
      <h1 className="text-5xl font-black text-white tracking-wider drop-shadow-lg">
        GAMEPOINT
      </h1>

      <p className="text-purple-300 text-sm tracking-[0.3em] mt-2">
        INTERNET CAFE
      </p>
    </div>

    {/* CARD */}
    <div className="bg-[#071225]/70 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md">

      <h1 className="text-center text-white text-xl font-semibold mb-6">
        Player Login
      </h1>

      <div className="space-y-4">

        <input
          placeholder="Player Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleLogin();
            }
          }}
          className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
        />

        <input
          type="password"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleLogin();
            }
          }}
          className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
        />

      </div>

      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full mt-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:scale-[1.02] active:scale-[0.98] transition duration-200 shadow-lg shadow-purple-500/30"
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