import { supabase } from "@/lib/supabase";
import type { MarketplacePost, MarketplacePostStatus } from "@/types";

export type MarketplaceFilter = {
  status?: MarketplacePostStatus;
  search?: string;
  sort?: "newest" | "highest_points" | "lowest_price";
};

export class MarketplaceRepository {
  async findAll(
    filter?: MarketplaceFilter,
    page?: number,
    pageSize?: number
  ): Promise<{ data: MarketplacePost[]; total: number }> {
    let query = supabase
      .from("marketplace_posts")
      .select("*, users(name, avatar_url)", { count: "exact" });

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }

    if (filter?.search) {
      query = query.ilike("users.name", `%${filter.search}%`);
    }

    const sortField =
      filter?.sort === "highest_points"
        ? "points_amount"
        : filter?.sort === "lowest_price"
          ? "asking_price"
          : "created_at";

    const sortOrder =
      filter?.sort === "lowest_price" ? true : false;

    query = query.order(sortField, { ascending: sortOrder });

    if (page !== undefined && pageSize !== undefined) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, count } = await query;
    return { data: data || [], total: count ?? 0 };
  }

  async findById(id: string): Promise<MarketplacePost | null> {
    const { data } = await supabase
      .from("marketplace_posts")
      .select("*, users(name, avatar_url)")
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  async findByUser(userId: string): Promise<MarketplacePost[]> {
    const { data } = await supabase
      .from("marketplace_posts")
      .select("*, users(name, avatar_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data || [];
  }

  async create(data: {
    user_id: string;
    points_amount: number;
    asking_price: number;
    payment_method: string;
    description?: string;
    status: MarketplacePostStatus;
  }): Promise<MarketplacePost> {
    const { data: post, error } = await supabase
      .from("marketplace_posts")
      .insert(data)
      .select("*, users(name, avatar_url)")
      .single();
    if (error) throw error;
    return post;
  }

  async update(
    id: string,
    data: Partial<{
      points_amount: number;
      asking_price: number;
      payment_method: string;
      description: string;
      status: MarketplacePostStatus;
    }>
  ): Promise<MarketplacePost> {
    const { data: post, error } = await supabase
      .from("marketplace_posts")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, users(name, avatar_url)")
      .single();
    if (error) throw error;
    return post;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("marketplace_posts")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }
}
