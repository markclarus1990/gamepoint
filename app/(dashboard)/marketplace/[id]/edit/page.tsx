"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Store } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import type { MarketplacePost } from "@/types";

export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [post, setPost] = useState<MarketplacePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [pointsAmount, setPointsAmount] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { window.location.href = "/login"; return; }
    setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (!params.id || !user) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/marketplace/${params.id}`);
        if (!res.ok) { router.push("/marketplace"); return; }
        const data: MarketplacePost = await res.json();
        if (data.user_id !== user.id) { router.push(`/marketplace/${params.id}`); return; }
        if (data.status !== "active") { toast.error("Cannot edit a non-active listing"); router.push(`/marketplace/${params.id}`); return; }
        setPost(data);
        setPointsAmount(String(data.points_amount));
        setAskingPrice(String(data.asking_price));
        setPaymentMethod(data.payment_method || "");
        setDescription(data.description || "");
      } catch { router.push("/marketplace"); }
      finally { setLoading(false); }
    };
    load();
  }, [params.id, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !post) return;

    const points = Number(pointsAmount);
    if (!points || points <= 0) { toast.error("Points must be greater than zero"); return; }

    if (post.listing_type === "fixed_price") {
      const price = Number(askingPrice);
      if (!price || price <= 0) { toast.error("Price must be greater than zero"); return; }
      if (!paymentMethod.trim()) { toast.error("Payment method is required"); return; }
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { user_id: user.id, description: description.trim() || "" };

      if (post.listing_type === "fixed_price") {
        payload.points_amount = points;
        payload.asking_price = Number(askingPrice);
        payload.payment_method = paymentMethod.trim();
      } else {
        payload.description = description.trim() || "";
      }

      const res = await fetch(`/api/marketplace/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to update listing"); return; }
      toast.success("Listing updated!");
      router.push(`/marketplace/${post.id}`);
    } catch { toast.error("Something went wrong"); }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-black"><Loader2 className="w-6 h-6 text-pink-500 animate-spin" /></div>;
  }
  if (!post) {
    return <div className="flex items-center justify-center min-h-screen bg-black text-zinc-500 text-sm">Listing not found</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Link href={`/marketplace/${post.id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Listing
        </Link>

        <div className="flex items-center gap-3">
          <Store className="w-6 h-6 text-pink-500" />
          <h1 className="text-xl font-bold">Edit {post.listing_type === "fixed_price" ? "Fixed Price" : "Auction"} Listing</h1>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
          <span className="text-xs text-zinc-500">Listing Type: </span>
          <span className="text-sm font-semibold text-zinc-300">{post.listing_type === "fixed_price" ? "Fixed Price" : "Auction"}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {post.listing_type === "fixed_price" && (
            <>
              <div>
                <label className="block text-xs text-zinc-500 font-medium mb-1.5">Points Amount *</label>
                <input type="number" value={pointsAmount} onChange={(e) => setPointsAmount(e.target.value)} min="1" required
                  className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 font-medium mb-1.5">Asking Price (₱) *</label>
                <input type="number" value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} min="1" required
                  className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 font-medium mb-1.5">Payment Method *</label>
                <input type="text" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required
                  className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800" />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">Description <span className="text-zinc-700">(optional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800 resize-none" />
          </div>

          <button type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm font-semibold hover:from-pink-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
