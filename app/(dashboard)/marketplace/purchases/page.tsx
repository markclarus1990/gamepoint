"use client";

import { useEffect, useState, useCallback } from "react";
import { ShoppingBag, Loader2, Eye, Store } from "lucide-react";
import Link from "next/link";
import type { Transaction } from "@/types";
import MarketplaceSubNav from "@/app/components/marketplace/MarketplaceSubNav";

export default function PurchasesPage() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { window.location.href = "/login"; return; }
    setUser(JSON.parse(stored));
  }, []);

  const fetchPurchases = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/marketplace/purchases?userId=${user.id}`);
      const data = await res.json();
      setTransactions(data.data || []);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-pink-500" />
          <h1 className="text-xl font-bold">My Purchases</h1>
        </div>

        <MarketplaceSubNav />

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-pink-500 animate-spin" /></div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
            <p className="text-zinc-500 text-sm">No purchases yet</p>
            <Link href="/marketplace" className="inline-block mt-3 text-sm text-pink-400 hover:text-pink-300">Browse Marketplace</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center text-xs font-bold text-white">
                      {tx.seller?.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        Purchased {tx.points_amount.toLocaleString()} points
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        From {tx.seller?.name || "Unknown"} — {new Date(tx.completed_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-pink-400">
                      {tx.listing_type === "fixed_price" ? "₱" : ""}{tx.price.toLocaleString()}
                    </span>
                    <Link href={`/marketplace/${tx.listing_id}`} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
                      <Eye className="w-4 h-4 text-zinc-500" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
