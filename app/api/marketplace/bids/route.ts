import { BidService } from "@/lib/services/BidService";

const bidService = new BidService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const bids = await bidService.getUserBids(userId);
  return Response.json(bids);
}
