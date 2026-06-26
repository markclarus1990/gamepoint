import { MarketplaceService } from "@/lib/services/MarketplaceService";

const marketplaceService = new MarketplaceService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const userId = searchParams.get("userId");
  if (userId) {
    const posts = await marketplaceService.findByUser(userId);
    return Response.json(posts);
  }

  const status = searchParams.get("status") as
    | "available"
    | "reserved"
    | "completed"
    | null;
  const search = searchParams.get("search");
  const sort = searchParams.get("sort") as
    | "newest"
    | "highest_points"
    | "lowest_price"
    | null;
  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");

  const result = await marketplaceService.findAll(
    {
      status: status || undefined,
      search: search || undefined,
      sort: sort || undefined,
    },
    page ? Number(page) : undefined,
    pageSize ? Number(pageSize) : undefined
  );

  return Response.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { user_id, points_amount, asking_price, payment_method, description } =
    body;

  if (!user_id) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  const result = await marketplaceService.create(user_id, {
    points_amount,
    asking_price,
    payment_method,
    description,
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result.success);
}
