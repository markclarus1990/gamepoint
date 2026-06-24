import { RedeemService } from "@/lib/services/RedeemService";

const redeemService = new RedeemService();

export async function POST(req: Request) {
  const { user_id, points } = await req.json();

  const result = await redeemService.createRequest(user_id, points);

  if ("error" in result) {
    return Response.json({ error: result.error });
  }

  return Response.json({ success: true });
}
