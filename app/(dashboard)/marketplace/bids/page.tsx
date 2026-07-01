"use client";

import { useEffect, useState, useCallback } from "react";
import { Gavel, Loader2, Eye, Store } from "lucide-react";
import Link from "next/link";
import type { Bid } from "@/types";
import MarketplaceSubNav from "@/app/components/marketplace/MarketplaceSubNav";

export default function MyBidsPage() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { window.location.href = "/login"; return; }
    setUser(JSON.parse(stored));
  }, []);

  const fetchBids = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/marketplace/bids?userId=${user.id}`);
      const data = await res.json();
      setBids(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchBids(); }, [fetchBids]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Gavel className="w-6 h-6 text-amber-400" />
          <h1 className="text-xl font-bold">My Bids</h1>
        </div>

        <MarketplaceSubNav />

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-pink-500 animate-spin" /></div>
        ) : bids.length === 0 ? (
          <div className="text-center py-20">
            <Gavel className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
            <p className="text-zinc-500 text-sm">No bids placed yet</p>
            <Link href="/marketplace?listingType=auction" className="inline-block mt-3 text-sm text-amber-400 hover:text-amber-300">Browse Auctions</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bids.map((bid) => (
              <Link key={bid.id} href={`/marketplace/${bid.listing_id}`}
                className="flex items-center justify-between bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center text-xs font-bold text-white">
                    <Gavel className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Bid {bid.amount.toLocaleString()} points
                    </div>
                    <div className="text-[10px] text-zinc-500">{new Date(bid.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <Eye className="w-4 h-4 text-zinc-500" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
