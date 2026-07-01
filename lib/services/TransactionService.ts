import { TransactionRepository } from "@/lib/repositories/TransactionRepository";
import type { Transaction } from "@/types";

export class TransactionService {
  private repo = new TransactionRepository();

  async getPurchases(
    userId: string,
    page?: number,
    pageSize?: number
  ): Promise<{ data: Transaction[]; total: number }> {
    return this.repo.findPurchasesByUser(userId, page, pageSize);
  }

  async getSales(
    userId: string,
    page?: number,
    pageSize?: number
  ): Promise<{ data: Transaction[]; total: number }> {
    return this.repo.findSalesByUser(userId, page, pageSize);
  }

  async getAllTransactions(
    userId: string,
    page?: number,
    pageSize?: number
  ): Promise<{ data: Transaction[]; total: number }> {
    return this.repo.findAllByUser(userId, page, pageSize);
  }

  async getByListing(listingId: string): Promise<Transaction | null> {
    return this.repo.findByListing(listingId);
  }
}
