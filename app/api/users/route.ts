import { UserService } from "@/lib/services/UserService";

const userService = new UserService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");

  if (page && pageSize) {
    const result = await userService.getUsers("points", Number(page), Number(pageSize));
    return Response.json({ data: result.data, total: result.total, page: Number(page), pageSize: Number(pageSize) });
  }

  const result = await userService.getUsers("points");
  return Response.json(result.data);
}
