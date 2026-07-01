export interface User {
  id: string;
  name: string;
  pin: string;
  points: number;
  reserved_points: number;
  avatar_url: string | null;
  is_admin?: boolean;
  created_at?: string;
}

export interface Session {
  id: string;
  user_name: string;
  user_id?: string;
  amount: number;
  minutes: number;
  points: number;
  created_at: string;
}

export interface RedeemRequest {
  id: string;
  user_id: string;
  points_used: number;
  minutes: number;
  status: string;
  created_at: string;
  users?: { name: string };
}

export interface HistoryItem {
  id: string;
  type: "session" | "redeem";
  amount: number;
  minutes: number;
  created_at: string;
  status?: string;
  user_name?: string;
  user_id?: string;
  points_used?: number;
  [key: string]: unknown;
}

export interface UserStats {
  total_minutes: number;
  total_hours: string;
}

export interface LeaderboardEntry {
  name: string;
  total_minutes: number;
  avatar_url: string;
}

export interface PublicUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface LoginResponse {
  id: string;
  name: string;
  avatar_url: string | null;
  is_admin: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Conversation {
  id: string;
  user_id: string;
  status: "open" | "closed";
  type: "support" | "direct";
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "player" | "admin";
  content: string;
  created_at: string;
  read_at: string | null;
  users?: { name: string; avatar_url: string | null };
}

export interface DirectConversationSummary {
  id: string;
  other_user: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export type MarketplacePostStatus = "active" | "completed" | "cancelled" | "expired";
export type MarketplaceListingType = "fixed_price" | "auction";

export interface MarketplacePost {
  id: string;
  user_id: string;
  points_amount: number;
  asking_price: number;
  payment_method: string | null;
  description: string | null;
  status: MarketplacePostStatus;
  listing_type: MarketplaceListingType;
  starting_bid: number | null;
  min_increment: number | null;
  end_time: string | null;
  reserve_price: number | null;
  buyer_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  users?: { name: string; avatar_url: string | null };
}

export interface Bid {
  id: string;
  listing_id: string;
  user_id: string;
  amount: number;
  created_at: string;
  users?: { name: string; avatar_url: string | null };
}

export interface Transaction {
  id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  points_amount: number;
  price: number;
  listing_type: MarketplaceListingType;
  status: string;
  created_at: string;
  completed_at: string;
  seller?: { name: string; avatar_url: string | null };
  buyer?: { name: string; avatar_url: string | null };
  listing?: MarketplacePost;
}

export interface PointLedgerEntry {
  id: string;
  user_id: string;
  type: "earned" | "redeemed" | "reserved" | "released" | "purchased" | "sold" | "admin_adjustment";
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface SavedListing {
  user_id: string;
  listing_id: string;
  created_at: string;
}
