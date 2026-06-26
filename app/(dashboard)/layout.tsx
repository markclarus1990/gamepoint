"use client";

import { useState, useEffect, useRef } from "react";
import {
  Menu, X, Gamepad2, MessageCircle, LayoutDashboard,
  LogOut, Mail, Swords, Trophy, User, Settings, ChevronDown, Store, Calculator,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "@/app/components/NotificationBell";
import CalculatorModal from "@/app/components/CalculatorModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; avatar_url?: string; points?: number } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("isAdmin");
    window.location.href = "/login";
  };

  const handleCalculatorOpen = () => {
    setCalculatorOpen(true);
    if (user?.id) {
      fetch(`/api/user?id=${user.id}`)
        .then((r) => r.json())
        .then((data) => {
          setUserPoints(data.user?.points ?? 0);
        })
        .catch(() => {});
    }
  };

  const navLinks = [
    { label: "Dashboard", href: "/home", icon: LayoutDashboard },
    { label: "Marketplace", href: "/marketplace", icon: Store },
    { label: "Messages", href: "/messages", icon: Mail },
    { label: "Tournaments", href: "/tekken", icon: Swords },
    { label: "Leaderboard", href: "/#top-players", icon: Trophy },
  ];

  const profileLinks = [
    { label: "Profile", href: "/home", icon: User },
    { label: "Support", href: "/chat", icon: MessageCircle },
    { label: "Change PIN", href: "/change-password", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-black">
      <nav className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
        <div className="px-4">
          <div className="flex items-center justify-between h-14">
            <Link href="/home" className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-pink-500" />
              <span className="text-base font-black tracking-wider text-white">
                GAME<span className="text-pink-500">POINT</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-pink-500/10 text-pink-400"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
              <button
                onClick={handleCalculatorOpen}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Calculator className="w-4 h-4" />
                Points Calculator
              </button>
            </div>

            <div className="hidden md:flex items-center gap-1">
              <NotificationBell />
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      user?.name?.charAt(0).toUpperCase() || "?"
                    )}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/50 py-1.5 z-50">
                    <div className="px-3 py-2 border-b border-zinc-800">
                      <div className="text-sm font-semibold text-white truncate">
                        {user?.name || "Player"}
                      </div>
                      <div className="text-[10px] text-zinc-500">Player</div>
                    </div>
                    {profileLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                      >
                        <link.icon className="w-4 h-4" />
                        {link.label}
                      </Link>
                    ))}
                    <hr className="border-zinc-800 my-1" />
                    <button
                      onClick={logout}
                      className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setOpen(!open)}
              className="md:hidden p-2 text-white"
              aria-label="Toggle menu"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-pink-500/10 text-pink-400"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
              <button
                onClick={() => {
                  setOpen(false);
                  handleCalculatorOpen();
                }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Calculator className="w-4 h-4" />
                Points Calculator
              </button>
              <hr className="border-zinc-800 my-2" />
              <div className="px-3 py-2 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                  {user?.name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="text-xs text-zinc-500 truncate">{user?.name || "Player"}</div>
              </div>
              {profileLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
              <button
                onClick={logout}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>
      <main>{children}</main>
      <CalculatorModal
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        currentPoints={userPoints}
      />
    </div>
  );
}
