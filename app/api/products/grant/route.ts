import { ProductService } from "@/lib/services/ProductService";

const productService = new ProductService();

export async function POST(req: Request) {
  const { order_id } = await req.json();

  if (!order_id) {
    return Response.json({ error: "order_id is required" }, { status: 400 });
  }

  const result = await productService.grantOrder(order_id);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ success: true });
}
