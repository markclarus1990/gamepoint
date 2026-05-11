"use client";

import { useEffect, useState } from "react";

export default function Login() {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [topPlayers, setTopPlayers] = useState<any[]>([]);

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

  useEffect(() => {
    loadTopPlayers();
  }, []);

  const loadTopPlayers = async () => {
    try {
      const res = await fetch("/api/top-players");
      const data = await res.json();

      setTopPlayers(data);
    } catch (err) {
      console.log(err);
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
      {/* CENTER WRAPPER */}
    <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8 w-full max-w-5xl">

        {/* LEFT LEADERBOARD */}
        <div className="
w-full
max-w-sm
md:w-[190px]
h-[220px]
md:h-[430px]
rounded-[30px]
border-2
border-pink-500/80
bg-black/60
backdrop-blur-md
overflow-hidden
shadow-2xl
">

          {/* HEADER */}
          <div className="p-4 border-b border-pink-500/20">
            <h2 className="text-white text-center font-black text-lg tracking-wider">
              TOP PLAYERS
            </h2>

            <p className="text-center text-xs text-pink-300 mt-1">
              Hall of Fame
            </p>
          </div>

          {/* SCROLL AREA */}
          <div className="relative h-[140px] md:h-[340px] overflow-hidden">

            <div className="absolute w-full animate-scroll-up py-4 space-y-3">

             {[...topPlayers, ...topPlayers].map((player, index) => (
  <div
    key={`${player.id}-${index}`}
    className="mx-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm"
  >
    <div className="flex items-center gap-3">

      {/* AVATAR */}
      <img
        src={
          player.avatar_url ||
          "https://placehold.co/100x100/png"
        }
        alt={player.name}
    className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-pink-500 shadow-lg shadow-pink-500/30"
      />

      {/* INFO */}
      <div className="flex-1 min-w-0">

        <div className="flex items-center justify-between">

          <span className="text-pink-400 font-black text-sm">
            #{(index % topPlayers.length) + 1}
          </span>

          <span className="text-white font-semibold text-sm truncate">
            {player.name}
          </span>

        </div>

        <div className="mt-1 text-cyan-300 text-xs">
          {(player.points || 0).toLocaleString()} pts
        </div>

      </div>

    </div>
  </div>
))}

            </div>

          </div>
        </div>

        {/* LOGIN SIDE */}
        <div className="w-full max-w-sm">

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
    </div>
  );
}