"use client";

import { useEffect, useRef, useState } from "react";
export default function Login() {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string | null>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      localStorage.setItem("isAdmin", data.is_admin ? "true" : "false");
      localStorage.setItem("user", JSON.stringify(data));

      if (data.is_admin) {
        window.location.href = "/admin";
      } else {
        window.location.href = "/home";
      }
    }
  };

  const startDeviceLogin = async () => {
    setDeviceLoading(true);
    setDeviceError(null);
    try {
      const res = await fetch("/api/auth/github/device", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setDeviceError(data.error);
        setDeviceLoading(false);
        return;
      }
      setDeviceCode(data.device_code);
      setUserCode(data.user_code);
      setVerificationUri(data.verification_uri);

      const interval = (data.interval || 5) * 1000;
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch("/api/auth/github/device/poll", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device_code: data.device_code }),
          });
          const pollData = await pollRes.json();
          if (pollData.status === "authorized") {
            if (pollRef.current) clearInterval(pollRef.current);
            localStorage.setItem("isAdmin", pollData.user.is_admin ? "true" : "false");
            localStorage.setItem("user", JSON.stringify(pollData.user));
            window.location.href = pollData.user.is_admin ? "/admin" : "/home";
          }
        } catch {
          // continue polling
        }
      }, interval);
    } catch {
      setDeviceError("Failed to start device login");
    }
    setDeviceLoading(false);
  };

  const stopDeviceLogin = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setDeviceCode(null);
    setUserCode(null);
    setVerificationUri(null);
    setDeviceError(null);
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
const formatTime = (mins: number) => {

  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
};
useEffect(() => {

  const params = new URLSearchParams(window.location.search);

  const githubUserParam = params.get("github_user");
  if (githubUserParam) {
    try {
      const data = JSON.parse(decodeURIComponent(githubUserParam));
      localStorage.setItem("isAdmin", data.is_admin ? "true" : "false");
      localStorage.setItem("user", JSON.stringify(data));
      window.location.href = data.is_admin ? "/admin" : "/home";
      return;
    } catch {
      // fall through
    }
  }

  const errorParam = params.get("error");
  if (errorParam) {
    alert("GitHub login failed. Please try again.");
  }

  const username = params.get("u");
  const password = params.get("p");

  if (!username || !password) return;

  const autoLogin = async () => {

    try {

      setLoading(true);

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: username, pin: password }),
      });

      const data = await res.json();

      setLoading(false);

      if (data.error) {
        alert("Invalid NFC login");
        return;
      }

      localStorage.setItem("isAdmin", data.is_admin ? "true" : "false");
      localStorage.setItem("user", JSON.stringify(data));

      if (data.is_admin) {
        window.location.href = "/admin";
      } else {
        window.location.href = "/home";
      }

    } catch (err) {

      console.log(err);
      setLoading(false);

    }
  };

  autoLogin();

}, []);
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
    <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-6xl">

  {/* TOP 3 PLAYERS */}
  <div
    className="
    w-full
    max-w-2xl
    mb-6
    rounded-[32px]
    border-2
    border-pink-500/80
    bg-black/60
    backdrop-blur-md
    shadow-2xl
    overflow-hidden
  "
  >

    {/* HEADER */}
    <div className="flex justify-center pt-3">
      <div className="px-10 py-2 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white font-black tracking-widest text-lg shadow-lg">
        TOP 3
      </div>
    </div>

    {/* TOP 3 CONTENT */}
    <div className="grid grid-cols-3 gap-4 p-6 items-end text-center">

      {/* 2ND */}
      {topPlayers[1] && (
        <div className="flex flex-col items-center">
          <div className="text-white font-black text-3xl mb-2">
            2ND
          </div>

          <img
            src={
              topPlayers[1].avatar_url ||
              "https://placehold.co/100x100/png"
            }
            alt={topPlayers[1].name}
            className="
              w-20
              h-20
              rounded-full
              object-cover
              border-4
              border-pink-400
              shadow-lg
              shadow-pink-500/40
            "
          />

      
          <div className="text-white font-bold truncate max-w-[100px]">
            {topPlayers[1].name}
          </div>

          <div className="text-cyan-300 text-sm font-semibold">
            {formatTime(topPlayers[1].total_minutes || 0)}
          </div>
        </div>
      )}

      {/* 1ST */}
      {topPlayers[0] && (
        <div className="flex flex-col items-center -mt-6">
          <div className="text-yellow-400 font-black text-4xl mb-2">
            1ST
          </div>

          <div className="relative">

            {/* LEFT LAUREL */}
            <div className="absolute -left-8 top-5 text-yellow-400 text-4xl">
              👑
            </div>

            <img
              src={
                topPlayers[0].avatar_url ||
                "https://placehold.co/100x100/png"
              }
              alt={topPlayers[0].name}
              className="
                w-28
                h-28
                rounded-full
                object-cover
                border-4
                border-yellow-400
                shadow-xl
                shadow-yellow-500/40
              "
            />
          </div>

         

          <div className="text-white font-black text-lg truncate max-w-[120px]">
            {topPlayers[0].name}
          </div>

          <div className="text-cyan-300 text-base font-bold">
           {formatTime(topPlayers[0].total_minutes || 0)}
          </div>
        </div>
      )}

      {/* 3RD */}
      {topPlayers[2] && (
        <div className="flex flex-col items-center">
          <div className="text-orange-400 font-black text-3xl mb-2">
            3RD
          </div>

          <img
            src={
              topPlayers[2].avatar_url ||
              "https://placehold.co/100x100/png"
            }
            alt={topPlayers[2].name}
            className="
              w-20
              h-20
              rounded-full
              object-cover
              border-4
              border-orange-400
              shadow-lg
              shadow-orange-500/40
            "
          />

      

          <div className="text-white font-bold truncate max-w-[100px]">
            {topPlayers[2].name}
          </div>

          <div className="text-cyan-300 text-sm font-semibold">
            {formatTime(topPlayers[2].total_minutes || 0)}
          </div>
        </div>
      )}

    </div>
  </div>


  {/* LOWER SECTION */}
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
                  {formatTime(player.total_minutes || 0)}
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

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#071225]/70 px-2 text-gray-400">or</span>
          </div>
        </div>

        <a
          href="/api/auth/github"
          className="flex items-center justify-center gap-3 w-full py-3 rounded-xl font-bold text-white bg-[#24292e] hover:bg-[#1b1f23] hover:scale-[1.02] active:scale-[0.98] transition duration-200 shadow-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          Sign in with GitHub
        </a>

        <button
          onClick={startDeviceLogin}
          disabled={deviceLoading}
          className="flex items-center justify-center gap-3 w-full py-3 rounded-xl font-bold text-white bg-[#24292e]/70 hover:bg-[#1b1f23] hover:scale-[1.02] active:scale-[0.98] transition duration-200 shadow-lg border border-white/10"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          {deviceLoading ? "Starting..." : "Device Login"}
        </button>

        {deviceError && (
          <p className="text-red-400 text-xs text-center mt-2">{deviceError}</p>
        )}

        {userCode && verificationUri && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center">
              <h2 className="text-white text-lg font-bold mb-4">GitHub Device Login</h2>
              <p className="text-gray-400 text-sm mb-4">
                Go to{" "}
                <a
                  href={verificationUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline font-semibold"
                >
                  {verificationUri}
                </a>{" "}
                and enter the code below:
              </p>
              <div className="bg-black/40 border border-white/10 rounded-xl py-4 px-6 mb-6">
                <span className="text-3xl font-black tracking-[0.3em] text-white select-all">
                  {userCode}
                </span>
              </div>
              <p className="text-gray-500 text-xs mb-4">Waiting for authorization...</p>
              <button
                onClick={stopDeviceLogin}
                className="text-sm text-gray-400 hover:text-white underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

     <div className="mt-4 space-y-3">
  <p className="text-center text-gray-400 text-sm">
    No account?{" "}
    <a
      href="/register"
      className="text-purple-400 hover:underline"
    >
      Register
    </a>
  </p>

  <a
    href="/tekken"
    className="block w-full text-center py-3 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-orange-500 hover:scale-[1.02] active:scale-[0.98] transition duration-200 shadow-lg"
  >
    🏆 View Tekken Tournament
  </a>
</div>

      </div>
    </div>
  </div>
</div>
    </div>
  );
}