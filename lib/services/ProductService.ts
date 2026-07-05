import { supabase } from "@/lib/supabase";
import { ProductRepository } from "@/lib/repositories/ProductRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import type { Product, ProductPurchase } from "@/types";

export class ProductService {
  private productRepo = new ProductRepository();
  private userRepo = new UserRepository();

  async getAll(): Promise<{ data: Product[] }> {
    const data = await this.productRepo.findAll();
    return { data };
  }

  async purchase(
    userId: string,
    productId: string
  ): Promise<{ success: true } | { error: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) return { error: "User not found" };

    const product = await this.productRepo.findById(productId);
    if (!product) return { error: "Product not found" };

    const already = await this.productRepo.findPurchase(productId, userId);
    if (already) return { error: "Already ordered" };

    try {
      await this.productRepo.createPurchase({
        product_id: productId,
        user_id: userId,
        points_spent: product.points_cost,
      });
    } catch {
      return { error: "Failed to create order" };
    }

    return { success: true };
  }

  async getPurchases(userId: string): Promise<{ data: ProductPurchase[] }> {
    const data = await this.productRepo.findPurchasesByUser(userId);
    return { data };
  }

  async getPendingOrders(): Promise<{ data: ProductPurchase[] }> {
    const data = await this.productRepo.findPendingOrders();
    return { data };
  }

  async grantOrder(orderId: string): Promise<{ success: true } | { error: string }> {
    const { data: order } = await supabase
      .from("product_purchases")
      .select("*, products(*)")
      .eq("id", orderId)
      .single();

    if (!order) return { error: "Order not found" };
    if (order.status !== "ordered") return { error: "Order already granted" };

    const user = await this.userRepo.findById(order.user_id);
    if (!user) return { error: "User not found" };

    const available = user.points - (user.reserved_points || 0);
    if (available < order.points_spent) {
      return { error: "User does not have enough points" };
    }

    const newPoints = user.points - order.points_spent;

    const { error: updateError } = await supabase
      .from("users")
      .update({ points: newPoints })
      .eq("id", order.user_id);

    if (updateError) return { error: "Failed to deduct points" };

    try {
      await this.productRepo.grantOrder(orderId);
    } catch {
      await supabase.from("users").update({ points: user.points }).eq("id", order.user_id);
      return { error: "Failed to grant order" };
    }

    return { success: true };
  }
}
