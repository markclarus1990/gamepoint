import { MarketplaceService } from "@/lib/services/MarketplaceService";

const marketplaceService = new MarketplaceService();

export async function POST() {
  await marketplaceService.checkAndCompleteExpiredAuctions();
  return Response.json({ success: true });
}
