import { supabase } from "@/lib/supabase";
import { UserRepository } from "@/lib/repositories/UserRepository";
import type { User } from "@/types";

export class UserService {
  private userRepo = new UserRepository();

  async getUsers(
    orderBy = "points",
    page?: number,
    pageSize?: number
  ): Promise<{ data: User[]; total: number }> {
    return this.userRepo.findAll(orderBy, page, pageSize);
  }

  async updateAvatar(
    userId: string,
    file: File
  ): Promise<{ url: string } | { error: string }> {
    try {
      const fileName = `${userId}-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        return { error: uploadError.message };
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("users")
        .update({ avatar_url: data.publicUrl })
        .eq("id", userId);

      if (dbError) {
        return { error: dbError.message };
      }

      return { url: data.publicUrl };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Avatar update failed";
      return { error: message };
    }
  }
}
