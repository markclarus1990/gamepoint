import { TransactionService } from "@/lib/services/TransactionService";

const transactionService = new TransactionService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");

  const result = await transactionService.getPurchases(
    userId,
    page ? Number(page) : undefined,
    pageSize ? Number(pageSize) : undefined
  );

  return Response.json(result);
}
