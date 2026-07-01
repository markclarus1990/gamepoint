"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Store, Gavel, Zap } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import type { MarketplaceListingType } from "@/types";

export default function CreateListingPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; points: number; reserved_points?: number } | null>(null);
  const [listingType, setListingType] = useState<MarketplaceListingType>("fixed_price");
  const [pointsAmount, setPointsAmount] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [description, setDescription] = useState("");
  const [startingBid, setStartingBid] = useState("");
  const [minIncrement, setMinIncrement] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { window.location.href = "/login"; return; }
    const parsed = JSON.parse(stored);
    fetch(`/api/user?id=${parsed.id}`)
      .then((r) => r.json())
      .then((data) => {
        setUser({ ...parsed, points: data.user?.points ?? 0, reserved_points: data.user?.reserved_points ?? 0 });
      });
  }, []);

  const availablePoints = user ? user.points - (user.reserved_points ?? 0) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const points = Number(pointsAmount);
    if (!points || points <= 0) { toast.error("Points must be greater than zero"); return; }
    if (points > availablePoints) { toast.error("You cannot list more points than you have available"); return; }

    if (listingType === "fixed_price") {
      const price = Number(askingPrice);
      if (!price || price <= 0) { toast.error("Price must be greater than zero"); return; }
      if (!paymentMethod.trim()) { toast.error("Payment method is required"); return; }
    } else {
      const bid = Number(startingBid);
      if (!bid || bid <= 0) { toast.error("Starting bid must be greater than zero"); return; }
      const inc = Number(minIncrement);
      if (!inc || inc <= 0) { toast.error("Minimum increment must be greater than zero"); return; }
      if (!endTime) { toast.error("End time is required"); return; }
      if (new Date(endTime) <= new Date()) { toast.error("End time must be in the future"); return; }
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        points_amount: points,
        listing_type: listingType,
        description: description.trim() || undefined,
      };

      if (listingType === "fixed_price") {
        payload.asking_price = Number(askingPrice);
        payload.payment_method = paymentMethod.trim();
      } else {
        payload.starting_bid = Number(startingBid);
        payload.min_increment = Number(minIncrement);
        payload.end_time = new Date(endTime).toISOString();
        if (reservePrice.trim()) payload.reserve_price = Number(reservePrice);
      }

      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create listing"); return; }
      toast.success("Listing created!");
      router.push(`/marketplace/${data.id}`);
    } catch { toast.error("Something went wrong"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        <div className="flex items-center gap-3">
          <Store className="w-6 h-6 text-pink-500" />
          <h1 className="text-xl font-bold">Create Listing</h1>
        </div>

        {user && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <span className="text-sm text-zinc-400">Available Points: </span>
            <span className="text-lg font-bold text-pink-400">{availablePoints.toLocaleString()}</span>
            {(user.reserved_points ?? 0) > 0 && (
              <span className="text-xs text-zinc-600 ml-2">({(user.reserved_points ?? 0).toLocaleString()} reserved)</span>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setListingType("fixed_price")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${
              listingType === "fixed_price"
                ? "bg-pink-500/10 border-pink-500/30 text-pink-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <Zap className="w-4 h-4" />
            Fixed Price
          </button>
          <button
            onClick={() => setListingType("auction")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${
              listingType === "auction"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <Gavel className="w-4 h-4" />
            Auction
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">Points Amount *</label>
            <input type="number" value={pointsAmount} onChange={(e) => setPointsAmount(e.target.value)} min="1" required
              placeholder="e.g. 500"
              className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800" />
          </div>

          {listingType === "fixed_price" ? (
            <>
              <div>
                <label className="block text-xs text-zinc-500 font-medium mb-1.5">Asking Price (₱) *</label>
                <input type="number" value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} min="1" required
                  placeholder="e.g. 100"
                  className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 font-medium mb-1.5">Payment Method *</label>
                <input type="text" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required
                  placeholder="e.g. GCash, Bank Transfer, PayMaya"
                  className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs text-zinc-500 font-medium mb-1.5">Starting Bid *</label>
                <input type="number" value={startingBid} onChange={(e) => setStartingBid(e.target.value)} min="1" required
                  placeholder="e.g. 100"
                  className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/50 border border-zinc-800" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 font-medium mb-1.5">Minimum Increment *</label>
                <input type="number" value={minIncrement} onChange={(e) => setMinIncrement(e.target.value)} min="1" required
                  placeholder="e.g. 10"
                  className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/50 border border-zinc-800" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 font-medium mb-1.5">Auction End Date & Time *</label>
                <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required
                  className="w-full bg-zinc-900 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/50 border border-zinc-800 [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 font-medium mb-1.5">
                  Reserve Price <span className="text-zinc-700">(optional)</span>
                </label>
                <input type="number" value={reservePrice} onChange={(e) => setReservePrice(e.target.value)} min="1"
                  placeholder="Minimum price to accept"
                  className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/50 border border-zinc-800" />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">
              Description <span className="text-zinc-700">(optional)</span>
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Add more details about your offer..."
              className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800 resize-none" />
          </div>

          <button type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm font-semibold hover:from-pink-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
            {submitting ? "Creating..." : "Create Listing"}
          </button>

          <p className="text-[10px] text-zinc-700 text-center">
            By creating a listing, your points will be reserved until the listing sells, expires, or is cancelled.
          </p>
        </form>
      </div>
    </div>
  );
}
