import { supabase } from "@/lib/supabase";

export async function POST(req) {
  try {
    const formData = await req.formData();

    const file = formData.get("file");
    const user_id = formData.get("user_id");

    if (!file) {
      return Response.json({ error: "No file uploaded" });
    }

    const fileName = `${user_id}-${Date.now()}.png`;

    // upload file to storage
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, {
        upsert: true, // 🔥 important
      });

    if (uploadError) {
      return Response.json({ error: uploadError.message });
    }

    // get public URL
    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    // update user avatar
    const { error: dbError } = await supabase
      .from("users")
      .update({ avatar_url: data.publicUrl })
      .eq("id", user_id);

    if (dbError) {
      return Response.json({ error: dbError.message });
    }

    return Response.json({ url: data.publicUrl });

  } catch (err) {
    return Response.json({ error: err.message });
  }
}