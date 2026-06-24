import { RedeemService } from "@/lib/services/RedeemService";

const redeemService = new RedeemService();

export async function POST(req: Request) {
  const { request_id } = await req.json();

  const result = await redeemService.approve(request_id);

  if ("error" in result) {
    return Response.json({ error: result.error });
  }

  return Response.json({ success: true });
}
