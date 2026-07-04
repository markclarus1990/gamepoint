import { ProductService } from "@/lib/services/ProductService";

const productService = new ProductService();

export async function GET() {
  const result = await productService.getAll();
  return Response.json(result.data);
}

export async function POST(req: Request) {
  const { user_id, product_id } = await req.json();

  if (!user_id || !product_id) {
    return Response.json({ error: "user_id and product_id are required" }, { status: 400 });
  }

  const result = await productService.purchase(user_id, product_id);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ success: true });
}
