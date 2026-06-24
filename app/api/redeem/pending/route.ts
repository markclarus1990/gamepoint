import { RedeemService } from "@/lib/services/RedeemService";

const redeemService = new RedeemService();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page");
    const pageSize = searchParams.get("pageSize");

    if (page && pageSize) {
      const result = await redeemService.getPending(Number(page), Number(pageSize));
      return Response.json({
        data: result.data,
        total: result.total,
        page: Number(page),
        pageSize: Number(pageSize),
      });
    }

    const result = await redeemService.getPending();
    return Response.json(result.data);
  } catch (err) {
    console.error("Server crash:", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
