import { BidService } from "@/lib/services/BidService";

const bidService = new BidService();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { user_id, amount } = body;

  if (!user_id) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  if (!amount || amount <= 0) {
    return Response.json({ error: "Bid amount must be greater than zero" }, { status: 400 });
  }

  const result = await bidService.placeBid(id, user_id, amount);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result.success);
}
