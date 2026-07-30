import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }

    const { count } = await supabase
      .from("tournament_registrations")
      .select("*", { count: "exact", head: true });

    if (count != null && count >= 8) {
      return Response.json({ error: "Tournament is full" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("tournament_registrations")
      .select("id")
      .eq("user_id", user_id)
      .single();

    if (existing) {
      return Response.json({ error: "Already registered" }, { status: 400 });
    }

    const { error } = await supabase
      .from("tournament_registrations")
      .insert({ user_id });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: string }).message)
        : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("tournament_registrations")
      .delete()
      .eq("user_id", user_id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: string }).message)
        : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
