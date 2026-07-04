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

    const available = user.points - (user.reserved_points || 0);
    if (available < product.points_cost) {
      return { error: "Not enough points" };
    }

    const already = await this.productRepo.findPurchase(productId, userId);
    if (already) return { error: "Already purchased" };

    const newPoints = user.points - product.points_cost;

    const { error: updateError } = await supabase
      .from("users")
      .update({ points: newPoints })
      .eq("id", userId);

    if (updateError) return { error: "Failed to deduct points" };

    try {
      await this.productRepo.createPurchase({
        product_id: productId,
        user_id: userId,
        points_spent: product.points_cost,
      });
    } catch {
      // Rollback points if purchase log fails
      await supabase.from("users").update({ points: user.points }).eq("id", userId);
      return { error: "Failed to record purchase" };
    }

    return { success: true };
  }

  async getPurchases(userId: string): Promise<{ data: ProductPurchase[] }> {
    const data = await this.productRepo.findPurchasesByUser(userId);
    return { data };
  }
}
