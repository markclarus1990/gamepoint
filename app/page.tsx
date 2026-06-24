"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Trophy,
  Swords,
  BarChart3,
  ChevronRight,
  Users,
  Sparkles,
} from "lucide-react";
import Footer from "@/app/components/Footer";

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
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-zinc-950" />

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 backdrop-blur-md px-4 py-1.5 text-sm text-pink-400 mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            GamePoint Internet Cafe
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-wider text-white mb-4">
            GAME<span className="text-pink-500 drop-shadow-[0_0_12px_rgba(236,72,153,0.5)]">POINT</span>
          </h1>

          <p className="text-xl md:text-2xl text-purple-400 tracking-[0.3em] mb-6">
            INTERNET CAFE
          </p>

          <p className="text-base md:text-lg text-gray-200 max-w-2xl mx-auto mb-8">
            Your premium gaming destination. Track sessions, earn points,
            compete in tournaments, and level up your gaming experience.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-8 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 transition-all shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 flex items-center gap-2"
            >
              Get Started <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/tekken"
              className="px-8 py-3.5 rounded-xl font-bold text-white border border-zinc-700 hover:border-pink-500/50 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-900/80 transition-all flex items-center gap-2"
            >
              <Swords className="w-4 h-4" /> View Tournaments
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 md:py-28 px-4 bg-zinc-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-md px-4 py-1.5 text-sm text-purple-400 mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Features
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              Why <span className="text-pink-500">GamePoint</span>?
            </h2>
            <p className="text-gray-300 max-w-xl mx-auto">
              Everything you need for the ultimate gaming cafe experience.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 hover:border-pink-500/30 hover:bg-zinc-900/80 hover:-translate-y-1 hover:shadow-lg hover:shadow-pink-500/5 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center mb-4 group-hover:bg-pink-500/20 group-hover:shadow-lg group-hover:shadow-pink-500/20 transition-all">
                  <f.icon className="w-6 h-6 text-pink-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-200 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TOURNAMENT PREVIEW */}
      <section className="py-20 md:py-28 px-4 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 backdrop-blur-md px-4 py-1.5 text-sm text-orange-400 mb-4">
              <Swords className="w-3.5 h-3.5" /> Active Tournament
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              TEKKEN 7 — SEASON 1
            </h2>
            <p className="text-gray-300 max-w-xl mx-auto">
              Battle every competitor in a full Round Robin format.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 md:p-8">
              <p className="text-gray-200 leading-relaxed mb-6">
                The player with the best overall record will be crowned the first
                GamePoint Tekken 7 Champion. Entry fee is ₱50 — sign up now at
                the counter to claim your slot.
              </p>
              <div className="flex flex-wrap gap-3 mb-6">
                <span className="rounded-full border border-zinc-700 bg-zinc-900/80 backdrop-blur-sm px-4 py-2 text-sm text-gray-200">
                  Entry Fee ₱50
                </span>
                <span className="rounded-full border border-zinc-700 bg-zinc-900/80 backdrop-blur-sm px-4 py-2 text-sm text-gray-200">
                  Round Robin
                </span>
                <span className="rounded-full border border-zinc-700 bg-zinc-900/80 backdrop-blur-sm px-4 py-2 text-sm text-gray-200">
                  8 Players
                </span>
              </div>
              <Link
                href="/tekken"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 transition-all shadow-lg shadow-red-500/20 hover:shadow-red-500/40"
              >
                Full Details <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 md:p-8 text-center shadow-2xl shadow-red-500/5 hover:shadow-red-500/10 transition-shadow">
              <div className="text-5xl md:text-6xl mb-4">🏆</div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                Champion <span className="text-orange-400">TBD</span>
              </h3>
              <p className="text-sm text-gray-300 mb-6">
                Season 1 registration is open. Sign up now to claim your spot.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-3">
                  <div className="text-2xl font-bold text-white">8</div>
                  <div className="text-xs text-gray-400 mt-1">Slots</div>
                </div>
                <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-3">
                  <div className="text-2xl font-bold text-white">28</div>
                  <div className="text-xs text-gray-400 mt-1">Matches</div>
                </div>
                <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-3">
                  <div className="text-2xl font-bold text-yellow-400">🏆</div>
                  <div className="text-xs text-gray-400 mt-1">Champion</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TOP PLAYERS */}
      <section id="top-players" className="py-20 md:py-28 px-4 bg-zinc-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 backdrop-blur-md px-4 py-1.5 text-sm text-yellow-400 mb-4">
              <Trophy className="w-3.5 h-3.5" /> Leaderboard
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              Top <span className="text-pink-500">Players</span>
            </h2>
            <p className="text-gray-300 max-w-xl mx-auto">
              Our most dedicated players with the highest playtime.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8 mb-14">
            {topPlayers[1] && (
              <div className="flex flex-col items-center order-2 md:order-1">
                <div className="font-black text-2xl md:text-3xl text-purple-400 mb-2 tracking-wider">
                  2ND
                </div>
                <img
                  src={topPlayers[1].avatar_url || "https://placehold.co/100x100/png"}
                  alt={topPlayers[1].name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-purple-500 shadow-xl shadow-purple-500/30"
                />
                <div className="text-white font-bold truncate max-w-[120px] mt-2">
                  {topPlayers[1].name}
                </div>
                <div className="text-cyan-400 text-sm font-semibold">
                  {formatTime(topPlayers[1].total_minutes)}
                </div>
              </div>
            )}

            {topPlayers[0] && (
              <div className="flex flex-col items-center order-1 md:order-2 md:-mt-8">
                <div className="font-black text-3xl md:text-4xl text-yellow-400 mb-2 tracking-wider drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]">
                  1ST
                </div>
                <div className="relative">
                  <div className="absolute -inset-1 rounded-full bg-yellow-500/20 blur-md" />
                  <img
                    src={topPlayers[0].avatar_url || "https://placehold.co/100x100/png"}
                    alt={topPlayers[0].name}
                    className="relative w-28 h-28 rounded-full object-cover border-4 border-yellow-400 shadow-2xl shadow-yellow-500/40"
                  />
                </div>
                <div className="text-white font-black text-lg truncate max-w-[120px] mt-2">
                  {topPlayers[0].name}
                </div>
                <div className="text-cyan-400 text-base font-bold">
                  {formatTime(topPlayers[0].total_minutes)}
                </div>
              </div>
            )}

            {topPlayers[2] && (
              <div className="flex flex-col items-center order-3">
                <div className="font-black text-2xl md:text-3xl text-orange-400 mb-2 tracking-wider">
                  3RD
                </div>
                <img
                  src={topPlayers[2].avatar_url || "https://placehold.co/100x100/png"}
                  alt={topPlayers[2].name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-orange-500 shadow-xl shadow-orange-500/30"
                />
                <div className="text-white font-bold truncate max-w-[120px] mt-2">
                  {topPlayers[2].name}
                </div>
                <div className="text-cyan-400 text-sm font-semibold">
                  {formatTime(topPlayers[2].total_minutes)}
                </div>
              </div>
            )}
          </div>

          <div className="w-full max-w-lg mx-auto rounded-[32px] border border-zinc-800 bg-zinc-900/60 backdrop-blur-md overflow-hidden shadow-2xl shadow-pink-500/5">
            <div className="p-4 border-b border-zinc-800 text-center">
              <h3 className="text-white font-black text-lg tracking-wider">
                <Users className="w-4 h-4 inline mr-2 text-pink-400" />
                ALL PLAYERS
              </h3>
            </div>
            <div className="relative h-[280px] md:h-[300px] overflow-hidden">
              <div className="absolute w-full animate-scroll-up py-4 space-y-3">
                {topPlayers.length > 0 &&
                  [...topPlayers, ...topPlayers].map((player, i) => (
                    <div
                      key={`${player.name}-${i}`}
                      className="mx-3 rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm p-3 hover:border-pink-500/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-pink-400 font-black text-sm min-w-[24px]">
                          #{(i % topPlayers.length) + 1}
                        </span>
                        <img
                          src={player.avatar_url || "https://placehold.co/100x100/png"}
                          alt={player.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-zinc-700"
                        />
                        <span className="text-white font-semibold text-sm flex-1 truncate">
                          {player.name}
                        </span>
                        <span className="text-cyan-400 text-xs font-semibold whitespace-nowrap">
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

      <Footer />
    </>
  );
}
