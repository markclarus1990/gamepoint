import { LedgerRepository } from "@/lib/repositories/LedgerRepository";
import type { PointLedgerEntry } from "@/types";

export class LedgerService {
  private repo = new LedgerRepository();

  async getLedger(
    userId: string,
    page?: number,
    pageSize?: number
  ): Promise<{ data: PointLedgerEntry[]; total: number }> {
    return this.repo.findByUser(userId, page, pageSize);
  }
}
