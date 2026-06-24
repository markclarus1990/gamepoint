import bcrypt from "bcryptjs";
import { UserRepository } from "@/lib/repositories/UserRepository";
import type { LoginResponse } from "@/types";

const SALT_ROUNDS = 10;

function isBcryptHash(str: string): boolean {
  return str.startsWith("$2a$") || str.startsWith("$2b$") || str.startsWith("$2y$");
}

export class AuthService {
  private userRepo = new UserRepository();

  async login(
    name: string,
    pin: string
  ): Promise<LoginResponse | { error: string }> {
    const user = await this.userRepo.findByName(name, true);

    if (!user) {
      return { error: "User not found" };
    }

    const storedPin = user.pin;
    let pinMatches = false;

    if (isBcryptHash(storedPin)) {
      pinMatches = await bcrypt.compare(pin, storedPin);
    } else {
      pinMatches = storedPin === pin;
      if (pinMatches) {
        const hashed = await bcrypt.hash(pin, SALT_ROUNDS);
        await this.userRepo.updatePin(user.id, hashed);
      }
    }

    if (!pinMatches) {
      return { error: "Invalid PIN" };
    }

    return {
      id: user.id,
      name: user.name,
      avatar_url: user.avatar_url,
      is_admin: user.is_admin ?? false,
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
      const hashedPin = await bcrypt.hash(pin, SALT_ROUNDS);
      await this.userRepo.create(name, hashedPin);
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

    const storedPin = user.pin;
    let oldPinMatches = false;

    if (isBcryptHash(storedPin)) {
      oldPinMatches = await bcrypt.compare(oldPin, storedPin);
    } else {
      oldPinMatches = storedPin === oldPin;
    }

    if (!oldPinMatches) {
      return { error: "Incorrect old PIN" };
    }

    if (!newPin || newPin.length !== 4) {
      return { error: "PIN must be 4 digits" };
    }

    try {
      const hashedNewPin = await bcrypt.hash(newPin, SALT_ROUNDS);
      await this.userRepo.updatePin(userId, hashedNewPin);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Password change failed";
      return { error: message };
    }
  }
}
