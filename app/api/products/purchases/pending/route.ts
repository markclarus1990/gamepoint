import { ProductService } from "@/lib/services/ProductService";

const productService = new ProductService();

export async function GET() {
  const result = await productService.getPendingOrders();
  return Response.json(result.data);
}
