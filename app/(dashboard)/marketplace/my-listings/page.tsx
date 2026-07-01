"use client";

import { useEffect, useState, useCallback } from "react";
import { Store, Eye, Loader2, Zap, CheckCircle2, Plus } from "lucide-react";
import Link from "next/link";
import type { MarketplacePost, MarketplacePostStatus } from "@/types";
import MarketplaceSubNav from "@/app/components/marketplace/MarketplaceSubNav";

export default function MyListingsPage() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [listings, setListings] = useState<MarketplacePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MarketplacePostStatus | "all">("all");

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { window.location.href = "/login"; return; }
    setUser(JSON.parse(stored));
  }, []);

  const fetchListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/marketplace?userId=${user.id}`);
      const data = await res.json();
      setListings(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const filtered = filter === "all" ? listings : listings.filter((l) => l.status === filter);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6 text-pink-500" />
            <h1 className="text-xl font-bold">My Listings</h1>
          </div>
          <Link href="/marketplace/create" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm font-semibold hover:from-pink-500 hover:to-purple-500 transition-all">
            <Plus className="w-4 h-4" /> Create Listing
          </Link>
        </div>

        <MarketplaceSubNav />

        <div className="flex gap-2 flex-wrap">
          {(["all", "active", "completed", "cancelled", "expired"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === s ? "bg-pink-500/10 text-pink-400 border border-pink-500/30" : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-pink-500 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Store className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
            <p className="text-zinc-500 text-sm">No listings found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((post) => (
              <Link key={post.id} href={`/marketplace/${post.id}`}
                className="flex items-center justify-between bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-xs font-bold text-white">
                    {post.users?.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{post.points_amount.toLocaleString()} points</div>
                    <div className="text-[10px] text-zinc-500">
                      {post.listing_type === "fixed_price" ? "₱" + post.asking_price.toLocaleString() : "Auction"} — {new Date(post.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    post.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : post.status === "completed" ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    : post.status === "cancelled" ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                  }`}>
                    {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                  </span>
                  <Eye className="w-4 h-4 text-zinc-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
