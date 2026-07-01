import { MarketplaceService } from "@/lib/services/MarketplaceService";
import type { MarketplacePostStatus, MarketplaceListingType } from "@/types";

const marketplaceService = new MarketplaceService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const userId = searchParams.get("userId");
  if (userId) {
    const posts = await marketplaceService.findByUser(userId);
    return Response.json(posts);
  }

  const buyerId = searchParams.get("buyerId");
  if (buyerId) {
    const posts = await marketplaceService.findByBuyer(buyerId);
    return Response.json(posts);
  }

  const status = searchParams.get("status") as MarketplacePostStatus | null;
  const listingType = searchParams.get("listingType") as MarketplaceListingType | null;
  const search = searchParams.get("search");
  const sort = searchParams.get("sort") as "newest" | "highest_points" | "lowest_price" | "ending_soon" | null;
  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");

  const result = await marketplaceService.findAll(
    {
      status: status || undefined,
      listingType: listingType || undefined,
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
  const {
    user_id,
    points_amount,
    asking_price,
    payment_method,
    description,
    listing_type,
    starting_bid,
    min_increment,
    end_time,
    reserve_price,
  } = body;

  if (!user_id) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  const result = await marketplaceService.create(user_id, {
    points_amount,
    asking_price,
    payment_method,
    description,
    listing_type,
    starting_bid,
    min_increment,
    end_time,
    reserve_price,
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result.success);
}
