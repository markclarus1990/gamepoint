import { UserRepository } from "@/lib/repositories/UserRepository";

export class AuthService {
  private userRepo = new UserRepository();

  async login(name: string, pin: string) {
    const user = await this.userRepo.findByName(name, true);

    if (!user) {
      return { error: "User not found" };
    }

    if (user.pin !== pin) {
      return { error: "Invalid PIN" };
    }

    return {
      id: user.id,
      name: user.name,
      avatar_url: user.avatar_url,
    };
  }

  async register(
    name: string,
    pin: string
  ): Promise<{ success: true } | { error: string; status: number }> {
    if (!name || !pin) {
      return { error: "Missing fields", status: 400 };
    }

    const exists = await this.userRepo.existsByName(name);
    if (exists) {
      return { error: "User already exists", status: 400 };
    }

    try {
      await this.userRepo.create(name, pin);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      return { error: message, status: 500 };
    }
  }

  async changePassword(
    userId: string,
    oldPin: string,
    newPin: string
  ): Promise<{ success: true } | { error: string }> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      return { error: "User not found" };
    }

    if (user.pin !== oldPin) {
      return { error: "Incorrect old PIN" };
    }

    if (!newPin || newPin.length !== 4) {
      return { error: "PIN must be 4 digits" };
    }

    try {
      await this.userRepo.updatePin(userId, newPin);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Password change failed";
      return { error: message };
    }
  }
}
