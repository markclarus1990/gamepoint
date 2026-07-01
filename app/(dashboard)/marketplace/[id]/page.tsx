"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, MessageCircle, Edit3, Trash2, BookmarkCheck, CheckCircle2,
  Loader2, Zap, Gavel, Timer, Heart, X, ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import type { MarketplacePost, MarketplacePostStatus, Bid } from "@/types";

function PurchaseConfirmModal({
  post, onConfirm, onClose, buying,
}: {
  post: MarketplacePost;
  onConfirm: () => void;
  onClose: () => void;
  buying: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/50">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Confirm Purchase</h3>
            <p className="text-xs text-zinc-500">Fixed price listing</p>
          </div>
        </div>

        <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500">Seller</span>
            <span className="text-sm font-medium text-white">{post.users?.name || "Unknown"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500">Points</span>
            <span className="text-sm font-bold text-pink-400">{post.points_amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500">Price</span>
            <span className="text-lg font-bold text-white">₱{post.asking_price.toLocaleString()}</span>
          </div>
          {post.payment_method && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">Payment Method</span>
              <span className="text-sm text-zinc-300">{post.payment_method}</span>
            </div>
          )}
        </div>

        <div className="bg-zinc-800/30 rounded-xl px-4 py-3 mb-5">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            By confirming, you agree to purchase {post.points_amount.toLocaleString()} points for ₱{post.asking_price.toLocaleString()}.
            The points will be transferred to your account immediately. This action cannot be undone.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 hover:text-white transition-all"
          >
            Cancel
          </button>
          <button onClick={onConfirm} disabled={buying}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-semibold hover:from-emerald-500 hover:to-green-500 transition-all disabled:opacity-50"
          >
            {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {buying ? "Processing..." : "Confirm Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; points?: number } | null>(null);
  const [post, setPost] = useState<MarketplacePost | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [placingBid, setPlacingBid] = useState(false);
  const [buying, setBuying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [showBuyModal, setShowBuyModal] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { window.location.href = "/login"; return; }
    setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (!params.id) return;
    const load = async () => {
      try {
        const [listingRes, savedRes] = await Promise.all([
          fetch(`/api/marketplace/${params.id}`),
          user ? fetch(`/api/marketplace/${params.id}/save?userId=${user.id}`).catch(() => null) : Promise.resolve(null),
        ]);
        if (!listingRes.ok) { router.push("/marketplace"); return; }
        const listing = await listingRes.json();
        setPost(listing);

        if (listing.listing_type === "auction") {
          const bidsRes = await fetch(`/api/marketplace/${params.id}/bids`);
          if (bidsRes.ok) {
            const bidsData = await bidsRes.json();
            setBids(bidsData);
          }
        }

        if (savedRes && savedRes.ok) {
          const savedData = await savedRes.json();
          setSaved(savedData.saved);
        }
      } catch { router.push("/marketplace"); }
      finally { setLoading(false); }
    };
    load();
  }, [params.id, router, user]);

  useEffect(() => {
    if (!post || post.listing_type !== "auction" || !post.end_time) return;
    const update = () => {
      const diff = new Date(post.end_time!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Ended"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 24) {
        const d = Math.floor(h / 24);
        setTimeLeft(`${d}d ${h % 24}h`);
      } else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
      else setTimeLeft(`${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [post]);

  const handleBuyNow = async () => {
    if (!user || !post) return;
    setBuying(true);
    try {
      const res = await fetch(`/api/marketplace/${post.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Purchase failed"); setBuying(false); setShowBuyModal(false); return; }
      toast.success("Purchase successful!");
      setShowBuyModal(false);
      router.refresh();
      window.location.reload();
    } catch { toast.error("Something went wrong"); setBuying(false); setShowBuyModal(false); }
  };

  const handlePlaceBid = async () => {
    if (!user || !post) return;
    const amount = Number(bidAmount);
    if (!amount || amount <= 0) { toast.error("Enter a valid bid amount"); return; }
    setPlacingBid(true);
    try {
      const res = await fetch(`/api/marketplace/${post.id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, amount }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to place bid"); return; }
      toast.success("Bid placed!");
      setBidAmount("");
      const bidsRes = await fetch(`/api/marketplace/${post.id}/bids`);
      if (bidsRes.ok) setBids(await bidsRes.json());
    } catch { toast.error("Something went wrong"); }
    finally { setPlacingBid(false); }
  };

  const handleCancel = async () => {
    if (!user || !post) return;
    if (!confirm("Cancel this listing? Reserved points will be released.")) return;
    const res = await fetch(`/api/marketplace/${post.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id }),
    });
    if (!res.ok) { const d = await res.json(); toast.error(d.error); return; }
    toast.success("Listing cancelled");
    router.refresh();
    window.location.reload();
  };

  const handleDelete = async () => {
    if (!user || !post) return;
    if (!confirm("Delete this listing?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/marketplace/${post.id}?userId=${user.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); toast.error(d.error); setDeleting(false); return; }
      router.push("/marketplace");
    } catch { setDeleting(false); toast.error("Failed to delete"); }
  };

  const handleToggleSave = async () => {
    if (!user || !post) return;
    const res = await fetch(`/api/marketplace/${post.id}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id }),
    });
    if (res.ok) { const d = await res.json(); setSaved(d.saved); }
  };

  const handleMessage = async () => {
    if (!user || !post) return;
    try {
      const res = await fetch("/api/conversations/direct", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, participantId: post.user_id }),
      });
      const data = await res.json();
      router.push(`/messages?conversation=${data.conversationId}`);
    } catch { router.push("/messages"); }
  };

  const isOwner = user && post && user.id === post.user_id;
  const isAuction = post?.listing_type === "auction";
  const isFixed = post?.listing_type === "fixed_price";
  const isActive = post?.status === "active";
  const highestBid = bids.length > 0 ? bids[0] : null;

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-black"><Loader2 className="w-6 h-6 text-pink-500 animate-spin" /></div>;
  }
  if (!post) {
    return <div className="flex items-center justify-center min-h-screen bg-black text-zinc-500 text-sm">Listing not found</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Marketplace
          </Link>
          <button onClick={handleToggleSave} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            saved ? "bg-pink-500/10 text-pink-400 border border-pink-500/30" : "bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"
          }`}>
            <Heart className={`w-3.5 h-3.5 ${saved ? "fill-pink-400" : ""}`} />
            {saved ? "Saved" : "Save"}
          </button>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-800">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden">
              {post.users?.avatar_url ? <img src={post.users.avatar_url} className="w-full h-full object-cover" /> : post.users?.name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1">
              <div className="text-base font-semibold text-white">{post.users?.name || "Unknown"}</div>
              <div className="text-xs text-zinc-500">Listed {new Date(post.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</div>
            </div>
            <StatusBadge status={post.status} />
          </div>

          <div className="flex items-center gap-2 mb-4">
            {isAuction ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Gavel className="w-3.5 h-3.5" /> Auction
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                <Zap className="w-3.5 h-3.5" /> Fixed Price
              </span>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Points</div>
                <div className="text-2xl font-bold text-pink-400">{post.points_amount.toLocaleString()}</div>
              </div>
              {isFixed ? (
                <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Price</div>
                  <div className="text-2xl font-bold text-white">₱{post.asking_price.toLocaleString()}</div>
                </div>
              ) : (
                <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Current Bid</div>
                  <div className="text-2xl font-bold text-amber-400">{highestBid ? highestBid.amount.toLocaleString() : post.starting_bid?.toLocaleString() || "—"}</div>
                </div>
              )}
            </div>

            {isAuction && post.end_time && (
              <div className="bg-zinc-800/50 rounded-xl p-4 flex justify-between items-center">
                <span className="text-xs text-zinc-500">Time Remaining</span>
                <span className={`text-sm font-mono font-semibold flex items-center gap-1.5 ${timeLeft === "Ended" ? "text-red-400" : timeLeft.includes("m") && !timeLeft.includes("h") ? "text-red-400" : "text-zinc-200"}`}>
                  <Timer className="w-3.5 h-3.5" />{timeLeft || "Calculating..."}
                </span>
              </div>
            )}

            {isAuction && (
              <div className="bg-zinc-800/50 rounded-xl p-4 flex justify-between items-center">
                <span className="text-xs text-zinc-500">Starting Bid</span>
                <span className="text-sm font-medium text-zinc-300">{post.starting_bid?.toLocaleString()}</span>
              </div>
            )}

            {isAuction && post.min_increment && (
              <div className="bg-zinc-800/50 rounded-xl p-4 flex justify-between items-center">
                <span className="text-xs text-zinc-500">Minimum Increment</span>
                <span className="text-sm font-medium text-zinc-300">{post.min_increment.toLocaleString()}</span>
              </div>
            )}

            {isAuction && post.reserve_price && (
              <div className="bg-zinc-800/50 rounded-xl p-4 flex justify-between items-center">
                <span className="text-xs text-zinc-500">Reserve Price</span>
                <span className="text-sm font-medium text-zinc-300">{post.reserve_price.toLocaleString()}</span>
              </div>
            )}

            {isFixed && post.payment_method && (
              <div className="bg-zinc-800/50 rounded-xl p-4 flex justify-between items-center">
                <span className="text-xs text-zinc-500">Payment Method</span>
                <span className="text-sm font-medium text-zinc-200">{post.payment_method}</span>
              </div>
            )}

            {post.description && (
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Description</div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{post.description}</p>
              </div>
            )}

            <div className="bg-zinc-800/50 rounded-xl p-4 flex justify-between items-center">
              <span className="text-xs text-zinc-500">Status</span>
              <StatusBadge status={post.status} />
            </div>

            {post.completed_at && (
              <div className="bg-zinc-800/50 rounded-xl p-4 flex justify-between items-center">
                <span className="text-xs text-zinc-500">Completed</span>
                <span className="text-sm font-medium text-zinc-300">{new Date(post.completed_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* ── Primary Actions ── */}
          <div className="space-y-2">
            {/* Fixed Price - Buy Now */}
            {isFixed && isActive && !isOwner && user && (
              <button onClick={() => setShowBuyModal(true)} disabled={buying}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-bold hover:from-emerald-500 hover:to-green-500 transition-all disabled:opacity-50 shadow-lg shadow-emerald-600/25"
              >
                <Zap className="w-5 h-5" />
                Buy Now — ₱{post.asking_price.toLocaleString()}
              </button>
            )}

            {/* Auction - Place Bid */}
            {isAuction && isActive && !isOwner && user && (
              <div className="bg-zinc-800/30 border border-zinc-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Your Bid</span>
                  {highestBid && (
                    <span className="text-xs text-zinc-500">
                      Current highest: <span className="text-amber-400 font-semibold">{highestBid.amount.toLocaleString()}</span>
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input type="number" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={highestBid ? `Min: ${(highestBid.amount + (post.min_increment || 1)).toLocaleString()}` : `Min: ${post.starting_bid?.toLocaleString()}`}
                    className="flex-1 bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/50 border border-zinc-700"
                  />
                  <button onClick={handlePlaceBid} disabled={placingBid}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-bold hover:from-amber-500 hover:to-orange-500 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-600/25"
                  >
                    {placingBid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                    Bid
                  </button>
                </div>
              </div>
            )}

            {/* Owner actions */}
            {isOwner && (
              <div className="space-y-2 pt-2">
                {isActive && (
                  <Link href={`/marketplace/${post.id}/edit`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 text-white text-sm font-semibold hover:bg-zinc-700 transition-all"
                  >
                    <Edit3 className="w-4 h-4" /> Edit Listing
                  </Link>
                )}
                {isActive && (
                  <button onClick={handleCancel}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-600/20 text-amber-400 text-sm font-semibold hover:bg-amber-600/30 border border-amber-500/20 transition-all"
                  >
                    <BookmarkCheck className="w-4 h-4" /> Cancel Listing
                  </button>
                )}
                {post.status !== "active" && (
                  <button onClick={handleDelete} disabled={deleting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600/10 text-red-400 text-sm font-semibold hover:bg-red-600/20 border border-red-500/10 transition-all disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete Listing
                  </button>
                )}
              </div>
            )}

            {/* ── Secondary: Ask Seller ── */}
            {!isOwner && user && (
              <button onClick={handleMessage}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-500 text-xs font-medium hover:text-zinc-300 hover:border-zinc-700 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Ask Seller a Question
              </button>
            )}
          </div>
        </div>

        {/* Bid History */}
        {isAuction && bids.length > 0 && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
              <Gavel className="w-4 h-4 text-amber-400" />
              Bid History ({bids.length})
            </h2>
            <div className="space-y-2">
              {bids.map((bid, i) => (
                <div key={bid.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/30">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center text-[8px] font-bold text-white">
                      {bid.users?.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <span className="text-sm text-zinc-300">{bid.users?.name || "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${i === 0 ? "text-amber-400" : "text-zinc-400"}`}>
                      {bid.amount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-zinc-600">{new Date(bid.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transaction info for completed listings */}
        {post.status === "completed" && !isOwner && post.buyer_id && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Transaction Complete
            </h2>
            <p className="text-xs text-zinc-500">
              {isOwner ? "You sold" : "You purchased"} {post.points_amount.toLocaleString()} points.
            </p>
          </div>
        )}
      </div>

      {/* Purchase Confirmation Modal */}
      {showBuyModal && post && (
        <PurchaseConfirmModal
          post={post}
          buying={buying}
          onConfirm={handleBuyNow}
          onClose={() => { if (!buying) setShowBuyModal(false); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: MarketplacePostStatus }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
    expired: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${styles[status] || styles.active}`}>
      {status === "active" ? <Zap className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
