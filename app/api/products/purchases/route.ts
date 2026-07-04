import { ProductService } from "@/lib/services/ProductService";

const productService = new ProductService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const result = await productService.getPurchases(userId);
  return Response.json(result);
}
