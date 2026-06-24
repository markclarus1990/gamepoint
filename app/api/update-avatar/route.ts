import { UserService } from "@/lib/services/UserService";

const userService = new UserService();

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const user_id = formData.get("user_id") as string | null;

  if (!file) {
    return Response.json({ error: "No file uploaded" });
  }

  if (!user_id) {
    return Response.json({ error: "User ID is required" });
  }

  const result = await userService.updateAvatar(user_id, file);

  if ("error" in result) {
    return Response.json({ error: result.error });
  }

  return Response.json({ url: result.url });
}
