"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, BellDot, MessageCircle, Store, CheckCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AppNotification } from "@/types";

const TYPE_ICONS: Record<string, React.ElementType> = {
  direct_message: MessageCircle,
  admin_reply: MessageCircle,
  marketplace_sold: Store,
  marketplace_bought: Store,
  marketplace_auction_won: Store,
  marketplace_auction_ended: Store,
  marketplace_outbid: Store,
  redeem_approved: CheckCircle,
};

export default function NotificationBell() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      const res = await fetch(`/api/notifications/unread?userId=${user.id}`);
      const data = await res.json();
      setUnreadCount(data.count ?? 0);
    };

    const fetchRecent = async () => {
      const res = await fetch(`/api/notifications?userId=${user.id}&page=1&pageSize=5`);
      const data = await res.json();
      setNotifications(data.data || []);
    };

    fetchUnread();
    fetchRecent();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as AppNotification;
          setUnreadCount((prev) => prev + 1);
          setNotifications((prev) => {
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev].slice(0, 5);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleNotifClick = useCallback(
    async (notif: AppNotification) => {
      if (!user) return;

      if (!notif.read_at) {
        await fetch(`/api/notifications/${notif.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n
          )
        );
      }

      setOpen(false);
      const data = notif.data as Record<string, unknown> | null;
      switch (notif.type) {
        case "direct_message":
          router.push(`/messages?conversation=${data?.conversation_id || ""}`);
          break;
        case "admin_reply":
          router.push("/chat");
          break;
        case "marketplace_sold":
        case "marketplace_bought":
        case "marketplace_auction_won":
        case "marketplace_auction_ended":
        case "marketplace_outbid":
          router.push(`/marketplace/${data?.listing_id || ""}`);
          break;
        case "redeem_approved":
          router.push("/home");
          break;
        default:
          router.push("/notifications");
      }
    },
    [user, router]
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <BellDot className="w-5 h-5 text-pink-400" />
        ) : (
          <Bell className="w-5 h-5 text-zinc-400 hover:text-white" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-pink-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={async () => {
                    if (!user) return;
                    await fetch("/api/notifications", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: user.id }),
                    });
                    setUnreadCount(0);
                    setNotifications((prev) =>
                      prev.map((n) => ({
                        ...n,
                        read_at: n.read_at || new Date().toISOString(),
                      }))
                    );
                  }}
                  className="text-[10px] text-pink-400 hover:text-pink-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-zinc-600">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const Icon = TYPE_ICONS[notif.type] || Bell;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleNotifClick(notif)}
                    className={`w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800 transition-colors ${
                      !notif.read_at ? "bg-pink-500/5" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          !notif.read_at
                            ? "bg-pink-500/10 text-pink-400"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-sm ${
                            !notif.read_at
                              ? "font-semibold text-white"
                              : "text-zinc-300"
                          }`}
                        >
                          {notif.title}
                        </div>
                        {notif.body && (
                          <div className="text-xs text-zinc-500 truncate mt-0.5">
                            {notif.body}
                          </div>
                        )}
                        <div className="text-[10px] text-zinc-600 mt-1">
                          {formatTimeAgo(notif.created_at)}
                        </div>
                      </div>
                      {!notif.read_at && (
                        <div className="w-2 h-2 rounded-full bg-pink-500 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1 px-4 py-2.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border-t border-zinc-800"
          >
            View All
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
