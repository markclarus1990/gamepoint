"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { ShoppingBag, Loader2, Check } from "lucide-react";
import MarketplaceSubNav from "@/app/components/marketplace/MarketplaceSubNav";
import type { Product } from "@/types";

export default function ShopPage() {
  const [user, setUser] = useState<{ id: string; name: string; points: number; reserved_points?: number } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { window.location.href = "/login"; return; }
    setUser(JSON.parse(stored));
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async (userId: string) => {
    try {
      const res = await fetch(`/api/products/purchases?userId=${userId}`);
      const data = await res.json();
      setPurchased(new Set((data.data || []).map((p: { product_id: string }) => p.product_id)));
    } catch {}
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (user) fetchPurchases(user.id);
  }, [user]);

  const handleBuy = async (productId: string) => {
    if (!user || buying) return;
    setBuying(productId);

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, product_id: productId }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Purchase failed");
        return;
      }

      setPurchased((prev) => new Set(prev).add(productId));

      const refresh = await fetch(`/api/user?id=${user.id}`);
      const refreshed = await refresh.json();
      setUser(refreshed.user);

      toast.success("Purchase successful!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBuying(null);
    }
  };

  const available = (user?.points || 0) - (user?.reserved_points || 0);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-pink-500" />
            <h1 className="text-xl font-bold">Shop</h1>
          </div>
          <div className="text-sm text-zinc-400">
            Points: <span className="text-pink-400 font-semibold">{available}</span>
          </div>
        </div>

        <MarketplaceSubNav />

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">No products available</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {products.map((product) => {
              const alreadyOwned = purchased.has(product.id);
              const canAfford = available >= product.points_cost && !alreadyOwned;
              const isBuying = buying === product.id;

              return (
                <div
                  key={product.id}
                  className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden hover:border-zinc-700 transition-colors"
                >
                  <div className="aspect-square bg-zinc-800 flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-4xl text-zinc-700 font-bold uppercase">
                        {product.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <h3 className="font-semibold text-sm">{product.name}</h3>

                    <div className="text-xs text-zinc-400">
                      {product.points_cost} points
                    </div>

                    <button
                      onClick={() => handleBuy(product.id)}
                      disabled={!canAfford || isBuying}
                      className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        alreadyOwned
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default"
                          : "bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      }`}
                    >
                      {isBuying ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : alreadyOwned ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : null}
                      {isBuying ? "Buying..." : alreadyOwned ? "Owned" : "Buy"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
