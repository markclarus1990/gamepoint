import { supabase } from "@/lib/supabase";
import { UserRepository } from "@/lib/repositories/UserRepository";

export class EscrowService {
  private userRepo = new UserRepository();

  async reserve(
    userId: string,
    amount: number,
    referenceId?: string,
    description?: string
  ): Promise<{ success: true } | { error: string }> {
    const { data, error } = await supabase.rpc("reserve_points", {
      p_user_id: userId,
      p_amount: amount,
      p_reference_id: referenceId || null,
      p_description: description || null,
    });

    if (error) return { error: error.message };
    const result = data as { success: boolean; error?: string };
    if (!result.success) return { error: result.error || "Failed to reserve points" };
    return { success: true };
  }

  async release(
    userId: string,
    amount: number,
    referenceId?: string,
    description?: string
  ): Promise<{ success: true } | { error: string }> {
    const { data, error } = await supabase.rpc("release_points", {
      p_user_id: userId,
      p_amount: amount,
      p_reference_id: referenceId || null,
      p_description: description || null,
    });

    if (error) return { error: error.message };
    const result = data as { success: boolean; error?: string };
    if (!result.success) return { error: result.error || "Failed to release points" };
    return { success: true };
  }

  async transfer(
    sellerId: string,
    buyerId: string,
    amount: number,
    referenceId?: string,
    description?: string
  ): Promise<{ success: true } | { error: string }> {
    const { data, error } = await supabase.rpc("transfer_points", {
      p_seller_id: sellerId,
      p_buyer_id: buyerId,
      p_amount: amount,
      p_reference_id: referenceId || null,
      p_description: description || null,
    });

    if (error) return { error: error.message };
    const result = data as { success: boolean; error?: string };
    if (!result.success) return { error: result.error || "Failed to transfer points" };
    return { success: true };
  }

  async getAvailablePoints(userId: string): Promise<number> {
    return this.userRepo.getAvailablePoints(userId);
  }
}
