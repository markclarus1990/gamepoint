export interface User {
  id: string;
  name: string;
  pin: string;
  points: number;
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
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "player" | "admin";
  content: string;
  created_at: string;
  read_at: string | null;
}
