"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageCircle,
  Edit3,
  Trash2,
  BookmarkCheck,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { MarketplacePost, MarketplacePostStatus } from "@/types";

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [post, setPost] = useState<MarketplacePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      window.location.href = "/login";
      return;
    }
    setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (!params.id) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/marketplace/${params.id}`);
        if (!res.ok) {
          router.push("/marketplace");
          return;
        }
        const data = await res.json();
        setPost(data);
      } catch {
        router.push("/marketplace");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id, router]);

  const handleMessage = async () => {
    if (!user || !post) return;
    try {
      const res = await fetch("/api/conversations/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          participantId: post.user_id,
        }),
      });
      const data = await res.json();
      router.push(`/messages?conversation=${data.conversationId}`);
    } catch {
      router.push("/messages");
    }
  };

  const handleStatusChange = async (status: MarketplacePostStatus) => {
    if (!user || !post) return;
    try {
      const res = await fetch(`/api/marketplace/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, status }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error);
        return;
      }
      const updated = await res.json();
      setPost(updated);
    } catch {
      alert("Failed to update listing");
    }
  };

  const handleDelete = async () => {
    if (!user || !post) return;
    if (!confirm("Are you sure you want to delete this listing?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/marketplace/${post.id}?userId=${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error);
        setDeleting(false);
        return;
      }
      router.push("/marketplace");
    } catch {
      setDeleting(false);
      alert("Failed to delete listing");
    }
  };

  const isOwner = user && post && user.id === post.user_id;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-zinc-500 text-sm">
        Listing not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Back */}
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        {/* Listing Card */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
          {/* Seller info */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-800">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden">
              {post.users?.avatar_url ? (
                <img
                  src={post.users.avatar_url}
                  className="w-full h-full object-cover"
                />
              ) : (
                post.users?.name?.charAt(0).toUpperCase() || "?"
              )}
            </div>
            <div className="flex-1">
              <div className="text-base font-semibold text-white">
                {post.users?.name || "Unknown"}
              </div>
              <div className="text-xs text-zinc-500">
                Listed{" "}
                {new Date(post.created_at).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
            <StatusBadge status={post.status} />
          </div>

          {/* Listing details */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                  Points
                </div>
                <div className="text-2xl font-bold text-pink-400">
                  {post.points_amount.toLocaleString()}
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                  Price
                </div>
                <div className="text-2xl font-bold text-white">
                  ₱{post.asking_price.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="bg-zinc-800/50 rounded-xl p-4 flex justify-between items-center">
              <span className="text-xs text-zinc-500">Payment Method</span>
              <span className="text-sm font-medium text-zinc-200">
                {post.payment_method}
              </span>
            </div>

            {post.description && (
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                  Description
                </div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {post.description}
                </p>
              </div>
            )}

            <div className="bg-zinc-800/50 rounded-xl p-4 flex justify-between items-center">
              <span className="text-xs text-zinc-500">Status</span>
              <StatusBadge status={post.status} />
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {!isOwner && user && (
              <button
                onClick={handleMessage}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm font-semibold hover:from-pink-500 hover:to-purple-500 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                Message Seller
              </button>
            )}

            {isOwner && (
              <div className="space-y-2">
                <Link
                  href={`/marketplace/${post.id}/edit`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 text-white text-sm font-semibold hover:bg-zinc-700 transition-all"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Listing
                </Link>

                {post.status === "available" && (
                  <button
                    onClick={() => handleStatusChange("reserved")}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-600/20 text-amber-400 text-sm font-semibold hover:bg-amber-600/30 border border-amber-500/20 transition-all"
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    Mark as Reserved
                  </button>
                )}
                {post.status === "reserved" && (
                  <button
                    onClick={() => handleStatusChange("completed")}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600/20 text-emerald-400 text-sm font-semibold hover:bg-emerald-600/30 border border-emerald-500/20 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark as Sold
                  </button>
                )}
                {(post.status === "available" || post.status === "reserved") && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600/10 text-red-400 text-sm font-semibold hover:bg-red-600/20 border border-red-500/10 transition-all disabled:opacity-50"
                  >
                    {deleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete Listing
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: MarketplacePostStatus }) {
  const styles: Record<string, string> = {
    available: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    reserved: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${styles[status]}`}
    >
      {status === "available" && <CheckCircle2 className="w-3 h-3" />}
      {status === "reserved" && <BookmarkCheck className="w-3 h-3" />}
      {status === "completed" && <Loader2 className="w-3 h-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
