import { MarketplaceService } from "@/lib/services/MarketplaceService";

const marketplaceService = new MarketplaceService();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { user_id } = body;

  if (!user_id) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  const result = await marketplaceService.toggleSave(user_id, id);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
