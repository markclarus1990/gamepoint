"use client";

import { useState, useEffect } from "react";
import { Menu, X, Gamepad2, MessageCircle, Shield, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("isAdmin");
    window.location.href = "/login";
  };

  const navLinks = [
    { label: "Dashboard", href: "/admin", icon: Shield },
    { label: "Messages", href: "/admin/chat", icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-black">
      <nav className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
        <div className="px-4">
          <div className="flex items-center justify-between h-14">
            <Link href="/admin" className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-pink-500" />
              <span className="text-base font-black tracking-wider text-white">
                GAME<span className="text-pink-500">POINT</span>
                <span className="ml-2 text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                  ADMIN
                </span>
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
                        ? "bg-purple-500/10 text-purple-400"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
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
                        ? "bg-purple-500/10 text-purple-400"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
              <hr className="border-zinc-800 my-2" />
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
    </div>
  );
}
