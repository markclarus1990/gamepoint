"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Gamepad2,
  Clock,
  Trophy,
  Swords,
  BarChart3,
  ChevronRight,
  Users,
} from "lucide-react";

type Player = {
  name: string;
  total_minutes: number;
  avatar_url: string;
};

const features = [
  {
    icon: Clock,
    title: "Session Tracking",
    desc: "Track every gaming session with automatic time logging and payment recording.",
  },
  {
    icon: Trophy,
    title: "Points & Rewards",
    desc: "Earn points for every peso spent and redeem them for more playtime.",
  },
  {
    icon: Swords,
    title: "Tournaments",
    desc: "Compete in Tekken tournaments and rise through the ranks to become champion.",
  },
  {
    icon: BarChart3,
    title: "Player Statistics",
    desc: "View your playtime history, track progress, and compare with top players.",
  },
];

const formatTime = (mins: number) => {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function LandingPage() {
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);

  useEffect(() => {
    fetch("/api/top-players")
      .then((r) => r.json())
      .then(setTopPlayers)
      .catch(() => {});
  }, []);

  return (
    <>
      {/* HERO */}
      <section
        id="home"
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/bg.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-[#020617]" />

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-1 text-sm text-pink-400 mb-6">
            <Gamepad2 className="w-4 h-4" />
            GamePoint Internet Cafe
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-wider text-white mb-4">
            GAME<span className="text-pink-500">POINT</span>
          </h1>

          <p className="text-xl md:text-2xl text-purple-300 tracking-[0.3em] mb-6">
            INTERNET CAFE
          </p>

          <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            Your premium gaming destination. Track sessions, earn points,
            compete in tournaments, and level up your gaming experience.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-8 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 transition-all shadow-lg shadow-pink-500/30 flex items-center gap-2"
            >
              Get Started <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/tekken"
              className="px-8 py-3 rounded-xl font-bold text-white border border-white/20 hover:border-pink-500/50 transition-all flex items-center gap-2"
            >
              <Swords className="w-4 h-4" /> View Tournaments
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 md:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Why <span className="text-pink-500">GamePoint</span>?
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Everything you need for the ultimate gaming cafe experience.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-pink-500/30 hover:bg-white/10 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center mb-4 group-hover:bg-pink-500/20 transition-colors">
                  <f.icon className="w-6 h-6 text-pink-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TOURNAMENT PREVIEW */}
      <section className="py-20 md:py-28 px-4 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1">
              <div className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1 text-sm text-red-400 mb-4">
                <Swords className="w-4 h-4 mr-2" /> Active Tournament
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                TEKKEN 7 — SEASON 1
              </h2>
              <p className="text-gray-400 mb-6">
                Battle every competitor in a full Round Robin format. The player
                with the best overall record will be crowned the first GamePoint
                Tekken 7 Champion.
              </p>
              <div className="flex flex-wrap gap-4 mb-8">
                <span className="rounded-full border border-zinc-700 bg-black/40 px-4 py-2 text-sm">
                  Entry Fee ₱50
                </span>
                <span className="rounded-full border border-zinc-700 bg-black/40 px-4 py-2 text-sm">
                  Round Robin
                </span>
                <span className="rounded-full border border-zinc-700 bg-black/40 px-4 py-2 text-sm">
                  8 Players
                </span>
              </div>
              <Link
                href="/tekken"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 transition-all"
              >
                View Tournament <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex-1 w-full max-w-md">
              <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-8 text-center">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Champion TBD
                </h3>
                <p className="text-sm text-zinc-400">
                  Season 1 registration is open. Sign up now to claim your spot.
                </p>
                <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">8</div>
                    <div className="text-xs text-zinc-500">Slots</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">28</div>
                    <div className="text-xs text-zinc-500">Matches</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">🏆</div>
                    <div className="text-xs text-zinc-500">Champion</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TOP PLAYERS */}
      <section id="top-players" className="py-20 md:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1 text-sm text-yellow-400 mb-4">
              <Trophy className="w-4 h-4" /> Leaderboard
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Top <span className="text-pink-500">Players</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Our most dedicated players with the highest playtime.
            </p>
          </div>

          {/* TOP 3 PODIUM */}
          <div className="flex flex-col md:flex-row items-end justify-center gap-6 mb-16">
            {[1, 0, 2].map((pos) => {
              const p = topPlayers[pos];
              if (!p) return null;
              const isFirst = pos === 0;
              return (
                <div
                  key={pos}
                  className={`flex flex-col items-center ${isFirst ? "md:-mt-6" : ""}`}
                >
                  <div
                    className={`font-black mb-2 ${
                      isFirst ? "text-yellow-400 text-4xl" : "text-3xl"
                    }`}
                  >
                    {pos === 0 ? "1ST" : pos === 1 ? "2ND" : "3RD"}
                  </div>
                  <img
                    src={
                      p.avatar_url || "https://placehold.co/100x100/png"
                    }
                    alt={p.name}
                    className={`rounded-full object-cover border-4 ${
                      isFirst
                        ? "w-28 h-28 border-yellow-400 shadow-xl shadow-yellow-500/40"
                        : "w-20 h-20 border-pink-400 shadow-lg shadow-pink-500/40"
                    }`}
                  />
                  <div className="text-white font-bold truncate max-w-[120px] mt-2">
                    {p.name}
                  </div>
                  <div className="text-cyan-300 text-sm font-semibold">
                    {formatTime(p.total_minutes)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* SCROLLING LEADERBOARD */}
          <div className="max-w-lg mx-auto rounded-[32px] border-2 border-pink-500/80 bg-black/60 backdrop-blur-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-pink-500/20 text-center">
              <h3 className="text-white font-black text-lg tracking-wider">
                <Users className="w-4 h-4 inline mr-2 text-pink-400" />
                ALL PLAYERS
              </h3>
            </div>
            <div className="relative h-[300px] overflow-hidden">
              <div className="absolute w-full animate-scroll-up py-4 space-y-3">
                {[...topPlayers, ...topPlayers].map((player, i) => (
                  <div
                    key={`${player.name}-${i}`}
                    className="mx-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-pink-400 font-black text-sm min-w-[24px]">
                        #{(i % topPlayers.length) + 1}
                      </span>
                      <img
                        src={
                          player.avatar_url ||
                          "https://placehold.co/100x100/png"
                        }
                        alt={player.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-pink-500"
                      />
                      <span className="text-white font-semibold text-sm flex-1 truncate">
                        {player.name}
                      </span>
                      <span className="text-cyan-300 text-xs font-semibold">
                        {formatTime(player.total_minutes || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="footer" className="border-t border-white/10 bg-black/50 px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Gamepad2 className="w-5 h-5 text-pink-500" />
                <span className="text-lg font-black tracking-wider">
                  GAME<span className="text-pink-500">POINT</span>
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Your premium gaming destination for competitive play and
                unforgettable experiences.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-4">Quick Links</h4>
              <div className="space-y-2 text-sm text-gray-500">
                <div>
                  <Link href="/" className="hover:text-pink-400 transition-colors">
                    Home
                  </Link>
                </div>
                <div>
                  <Link
                    href="/#top-players"
                    className="hover:text-pink-400 transition-colors"
                  >
                    Leaderboard
                  </Link>
                </div>
                <div>
                  <Link
                    href="/tekken"
                    className="hover:text-pink-400 transition-colors"
                  >
                    Tournaments
                  </Link>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-4">Account</h4>
              <div className="space-y-2 text-sm text-gray-500">
                <div>
                  <Link href="/login" className="hover:text-pink-400 transition-colors">
                    Login
                  </Link>
                </div>
                <div>
                  <Link
                    href="/register"
                    className="hover:text-pink-400 transition-colors"
                  >
                    Register
                  </Link>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-4">Contact</h4>
              <div className="space-y-2 text-sm text-gray-500">
                <p>GamePoint Internet Cafe</p>
                <p>Your Local Gaming Spot</p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 text-center text-sm text-gray-600">
            &copy; {new Date().getFullYear()} GamePoint. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
