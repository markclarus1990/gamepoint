"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  Store,
  MessageCircle,
  Eye,
  Loader2,
  Clock,
  CheckCircle2,
  BookmarkCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MarketplacePost, MarketplacePostStatus } from "@/types";

type SortOption = "newest" | "highest_points" | "lowest_price";

export default function MarketplacePage() {
  const router = useRouter();
  const [user, setUser] = useState<{
    id: string;
    name: string;
    avatar_url?: string;
  } | null>(null);
  const [listings, setListings] = useState<MarketplacePost[]>([]);
  const [myListings, setMyListings] = useState<MarketplacePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    MarketplacePostStatus | "all"
  >("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      window.location.href = "/login";
      return;
    }
    setUser(JSON.parse(stored));
  }, []);

  const fetchListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sort) params.set("sort", sort);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/marketplace?${params.toString()}`);
      const result = await res.json();
      setListings(result.data || result || []);

      const myRes = await fetch(
        `/api/marketplace?userId=${user.id}`
      );
      const myData = await myRes.json();
      setMyListings(Array.isArray(myData) ? myData : []);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, sort, search]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleMessageSeller = async (sellerId: string) => {
    if (!user) return;
    try {
      const res = await fetch("/api/conversations/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, participantId: sellerId }),
      });
      const data = await res.json();
      router.push(`/messages?conversation=${data.conversationId}`);
    } catch {
      router.push("/messages");
    }
  };

  const statusBadge = (status: MarketplacePostStatus) => {
    const styles: Record<string, string> = {
      available: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      reserved: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[status]}`}
      >
        {status === "available" && <CheckCircle2 className="w-3 h-3" />}
        {status === "reserved" && <BookmarkCheck className="w-3 h-3" />}
        {status === "completed" && <Clock className="w-3 h-3" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6 text-pink-500" />
            <h1 className="text-xl font-bold">Marketplace</h1>
          </div>
          <Link
            href="/marketplace/create"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm font-semibold hover:from-pink-500 hover:to-purple-500 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Listing
          </Link>
        </div>

        {/* Search + Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by player name..."
              className="w-full bg-zinc-900 text-white placeholder-zinc-500 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-800"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition-all ${
              showFilters
                ? "bg-pink-500/10 border-pink-500/30 text-pink-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
            <div>
              <label className="text-xs text-zinc-500 font-medium mb-2 block">
                Status
              </label>
              <div className="flex gap-2 flex-wrap">
                {(
                  ["all", "available", "reserved", "completed"] as const
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      statusFilter === s
                        ? "bg-pink-500/10 text-pink-400 border border-pink-500/30"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white"
                    }`}
                  >
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium mb-2 block">
                Sort By
              </label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "newest", label: "Newest" },
                  { value: "highest_points", label: "Highest Points" },
                  { value: "lowest_price", label: "Lowest Price" },
                ].map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setSort(o.value as SortOption)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sort === o.value
                        ? "bg-pink-500/10 text-pink-400 border border-pink-500/30"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* My Listings */}
        {myListings.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
              <Store className="w-4 h-4" />
              My Listings
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myListings.map((post) => (
                <ListingCard
                  key={post.id}
                  post={post}
                  isOwner={true}
                  currentUser={user}
                  onMessage={handleMessageSeller}
                  statusBadge={statusBadge}
                />
              ))}
            </div>
          </section>
        )}

        {/* All Listings */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
            <Store className="w-4 h-4" />
            {statusFilter === "all"
              ? "All Listings"
              : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) + " Listings"}
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-20">
              <Store className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-zinc-500 text-sm">No listings found</p>
              <Link
                href="/marketplace/create"
                className="inline-block mt-3 text-sm text-pink-400 hover:text-pink-300 transition-colors"
              >
                Create the first listing
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((post) => (
                <ListingCard
                  key={post.id}
                  post={post}
                  isOwner={post.user_id === user?.id}
                  currentUser={user}
                  onMessage={handleMessageSeller}
                  statusBadge={statusBadge}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ListingCard({
  post,
  isOwner,
  currentUser,
  onMessage,
  statusBadge,
}: {
  post: MarketplacePost;
  isOwner: boolean;
  currentUser: { id: string; name: string } | null;
  onMessage: (sellerId: string) => void;
  statusBadge: (status: MarketplacePostStatus) => React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-all backdrop-blur-sm">
      {/* Seller info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden">
          {post.users?.avatar_url ? (
            <img
              src={post.users.avatar_url}
              className="w-full h-full object-cover"
            />
          ) : (
            post.users?.name?.charAt(0).toUpperCase() || "?"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white truncate">
            {post.users?.name || "Unknown"}
          </div>
          <div className="text-[10px] text-zinc-500">
            {new Date(post.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
        {statusBadge(post.status)}
      </div>

      {/* Listing details */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-500">Points</span>
          <span className="text-sm font-bold text-pink-400">
            {post.points_amount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-500">Price</span>
          <span className="text-sm font-semibold text-white">
            ₱{post.asking_price.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-500">Payment</span>
          <span className="text-xs text-zinc-300">{post.payment_method}</span>
        </div>
        {post.description && (
          <p className="text-xs text-zinc-500 line-clamp-2 mt-1">
            {post.description}
          </p>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Link
          href={`/marketplace/${post.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 hover:text-white transition-all"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </Link>
        {!isOwner && currentUser && (
          <button
            onClick={() => onMessage(post.user_id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-medium hover:from-pink-500 hover:to-purple-500 transition-all"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Message
          </button>
        )}
      </div>
    </div>
  );
}
