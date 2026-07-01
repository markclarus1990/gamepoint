"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bell,
  MessageCircle,
  Store,
  CheckCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AppNotification } from "@/types";
import { supabase } from "@/lib/supabase";

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

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      window.location.href = "/login";
      return;
    }
    try {
      setUser(JSON.parse(stored));
    } catch {}
  }, []);

  const fetchPage = useCallback(
    async (p: number) => {
      if (!user) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/notifications?userId=${user.id}&page=${p}&pageSize=${PAGE_SIZE}`
        );
        const data = await res.json();
        setNotifications(data.data || []);
        setTotal(data.total || 0);
        setPage(p);

        const unreadRes = await fetch(`/api/notifications/unread?userId=${user.id}`);
        const unreadData = await unreadRes.json();
        setUnreadCount(unreadData.count ?? 0);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user) return;
    fetchPage(1);
  }, [user, fetchPage]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:page:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchPage(page);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, page, fetchPage]);

  const handleMarkAllRead = async () => {
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
  };

  const handleNotifClick = async (notif: AppNotification) => {
    if (!user) return;

    if (!notif.read_at) {
      await fetch(`/api/notifications/${notif.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
    }

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
        break;
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/home"
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </Link>
            <Bell className="w-6 h-6 text-pink-500" />
            <h1 className="text-xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-pink-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-pink-400 hover:text-pink-300 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
            <p className="text-zinc-500 text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const Icon = TYPE_ICONS[notif.type] || Bell;
              return (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={`w-full text-left flex items-start gap-4 px-4 py-4 rounded-xl border transition-all ${
                    !notif.read_at
                      ? "bg-pink-500/5 border-pink-500/10"
                      : "bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      !notif.read_at
                        ? "bg-pink-500/10 text-pink-400"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm ${
                        !notif.read_at ? "font-semibold text-white" : "text-zinc-300"
                      }`}
                    >
                      {notif.title}
                    </div>
                    {notif.body && (
                      <div className="text-xs text-zinc-500 mt-1">
                        {notif.body}
                      </div>
                    )}
                    <div className="text-[10px] text-zinc-600 mt-1.5">
                      {new Date(notif.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {!notif.read_at && (
                    <div className="w-2.5 h-2.5 rounded-full bg-pink-500 flex-shrink-0 mt-2" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => fetchPage(p)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                  p === page
                    ? "bg-pink-500/10 text-pink-400 border border-pink-500/30"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
