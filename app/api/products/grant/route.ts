import { ProductService } from "@/lib/services/ProductService";
import { ActivityLogService } from "@/lib/services/ActivityLogService";
import { supabase } from "@/lib/supabase";

const productService = new ProductService();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { order_id } = await req.json();

  if (!order_id) {
    return Response.json({ error: "order_id is required" }, { status: 400 });
  }

  // Capture order details BEFORE granting (grantOrder only returns { success })
  let userName = "unknown";
  let pointsSpent = 0;
  let productName = "unknown";
  try {
    const { data: order } = await supabase
      .from("product_purchases")
      .select("points_spent, user_id, products(name), users:users!product_purchases_user_id_fkey(name)")
      .eq("id", order_id)
      .maybeSingle();
    if (order) {
      pointsSpent = (order as { points_spent: number }).points_spent ?? 0;
      const prod = (order as unknown as { products: { name: string } | null }).products;
      if (prod?.name) productName = prod.name;
      const usr = (order as unknown as { users: { name: string } | null }).users;
      if (usr?.name) userName = usr.name;
      else {
        const { data: u } = await supabase
          .from("users")
          .select("name")
          .eq("id", (order as { user_id: string }).user_id)
          .maybeSingle();
        if (u?.name) userName = u.name;
      }
    }
  } catch {
    // ignore lookup errors
  }

  const result = await productService.grantOrder(order_id);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  void activityLog.logShopGrant("Admin", userName, pointsSpent, productName);

  return Response.json({ success: true });
}
