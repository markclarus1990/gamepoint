import { MarketplaceService } from "@/lib/services/MarketplaceService";

const marketplaceService = new MarketplaceService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const listings = await marketplaceService.getSavedListings(userId);
  return Response.json(listings);
}
