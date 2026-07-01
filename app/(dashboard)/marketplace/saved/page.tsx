"use client";

import { useEffect, useState, useCallback } from "react";
import { Heart, Loader2, Eye, Store, Zap, Timer, Gavel } from "lucide-react";
import Link from "next/link";
import type { MarketplacePost, MarketplacePostStatus } from "@/types";
import MarketplaceSubNav from "@/app/components/marketplace/MarketplaceSubNav";

export default function SavedPage() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [listings, setListings] = useState<MarketplacePost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { window.location.href = "/login"; return; }
    setUser(JSON.parse(stored));
  }, []);

  const fetchSaved = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/marketplace/saved?userId=${user.id}`);
      const data = await res.json();
      setListings(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  const statusBadge = (status: MarketplacePostStatus) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
      expired: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[status] || styles.active}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Heart className="w-6 h-6 text-pink-500" />
          <h1 className="text-xl font-bold">Saved Listings</h1>
        </div>

        <MarketplaceSubNav />

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-pink-500 animate-spin" /></div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
            <p className="text-zinc-500 text-sm">No saved listings</p>
            <Link href="/marketplace" className="inline-block mt-3 text-sm text-pink-400 hover:text-pink-300">Browse Marketplace</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map((post) => (
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
                      {post.users?.name || "Unknown"} — {post.listing_type === "fixed_price" ? "₱" + post.asking_price.toLocaleString() : "Auction"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(post.status)}
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
