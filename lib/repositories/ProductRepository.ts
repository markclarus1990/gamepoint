import { supabase } from "@/lib/supabase";
import type { Product, ProductPurchase } from "@/types";

export class ProductRepository {
  async findAll(): Promise<Product[]> {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("points_cost", { ascending: true });
    return data || [];
  }

  async findById(id: string): Promise<Product | null> {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  async findPurchase(productId: string, userId: string): Promise<ProductPurchase | null> {
    const { data } = await supabase
      .from("product_purchases")
      .select("*, products(*)")
      .eq("product_id", productId)
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  }

  async findPurchasesByUser(userId: string): Promise<ProductPurchase[]> {
    const { data } = await supabase
      .from("product_purchases")
      .select("*, products(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data || [];
  }

  async createPurchase(data: {
    product_id: string;
    user_id: string;
    points_spent: number;
  }): Promise<ProductPurchase> {
    const { data: purchase, error } = await supabase
      .from("product_purchases")
      .insert({ ...data, status: "ordered" })
      .select("*, products(*)")
      .single();
    if (error) throw error;
    return purchase;
  }

  async findPendingOrders(): Promise<ProductPurchase[]> {
    const { data } = await supabase
      .from("product_purchases")
      .select("*, products(*), users(name)")
      .eq("status", "ordered")
      .order("created_at", { ascending: false });
    return data || [];
  }

  async grantOrder(id: string): Promise<void> {
    const { error } = await supabase
      .from("product_purchases")
      .update({ status: "granted", granted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }
}
