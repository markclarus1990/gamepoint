import { BidService } from "@/lib/services/BidService";

const bidService = new BidService();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bids = await bidService.getBids(id);
  return Response.json(bids);
}
