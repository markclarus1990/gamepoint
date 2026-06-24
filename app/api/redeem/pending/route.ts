import { RedeemService } from "@/lib/services/RedeemService";

const redeemService = new RedeemService();

export async function GET() {
  try {
    const data = await redeemService.getPending();
    return Response.json(data);
  } catch (err) {
    console.error("Server crash:", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
