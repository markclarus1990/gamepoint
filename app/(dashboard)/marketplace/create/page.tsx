"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Store } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";

export default function CreateListingPage() {
  const router = useRouter();
  const [user, setUser] = useState<{
    id: string;
    name: string;
    points: number;
  } | null>(null);
  const [pointsAmount, setPointsAmount] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      window.location.href = "/login";
      return;
    }
    const parsed = JSON.parse(stored);
    // Fetch full user data to get current points
    fetch(`/api/user?id=${parsed.id}`)
      .then((r) => r.json())
      .then((data) => {
        setUser({ ...parsed, points: data.user?.points ?? 0 });
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const points = Number(pointsAmount);
    const price = Number(askingPrice);

    if (!points || points <= 0) {
      toast.error("Points must be greater than zero");
      return;
    }
    if (!price || price <= 0) {
      toast.error("Price must be greater than zero");
      return;
    }
    if (!paymentMethod.trim()) {
      toast.error("Payment method is required");
      return;
    }
    if (points > user.points) {
      toast.error("You cannot list more points than you own");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          points_amount: points,
          asking_price: price,
          payment_method: paymentMethod.trim(),
          description: description.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create listing");
        return;
      }
      toast.success("Listing created!");
      router.push(`/marketplace/${data.id}`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Back */}
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3">
          <Store className="w-6 h-6 text-pink-500" />
          <h1 className="text-xl font-bold">Create Listing</h1>
        </div>

        {/* Available points */}
        {user && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <span className="text-sm text-zinc-400">Available Points: </span>
            <span className="text-lg font-bold text-pink-400">
              {user.points.toLocaleString()}
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">
              Points Amount *
            </label>
            <input
              type="number"
              value={pointsAmount}
              onChange={(e) => setPointsAmount(e.target.value)}
              min="1"
              required
              placeholder="e.g. 500"
              className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">
              Asking Price (₱) *
            </label>
            <input
              type="number"
              value={askingPrice}
              onChange={(e) => setAskingPrice(e.target.value)}
              min="1"
              required
              placeholder="e.g. 100"
              className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">
              Payment Method *
            </label>
            <input
              type="text"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
              placeholder="e.g. GCash, Bank Transfer, PayMaya"
              className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">
              Description{" "}
              <span className="text-zinc-700">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add more details about your offer..."
              className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm font-semibold hover:from-pink-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Store className="w-4 h-4" />
            )}
            {submitting ? "Creating..." : "Create Listing"}
          </button>

          <p className="text-[10px] text-zinc-700 text-center">
            By creating a listing, you agree to negotiate directly with buyers.
            GAMEPOINT does not process payments or transfer points automatically.
          </p>
        </form>
      </div>
    </div>
  );
}
