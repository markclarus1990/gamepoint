import { supabase } from "@/lib/supabase";

export async function POST(req) {
  const { request_id } = await req.json();

  // 1. get request
  const { data: request } = await supabase
    .from("redeem_requests")
    .select("*")
    .eq("id", request_id)
    .single();

  if (!request) {
    return Response.json({ error: "Request not found" });
  }

  if (request.status !== "pending") {
    return Response.json({ error: "Already processed" });
  }

  // 2. deduct points from user
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", request.user_id)
    .single();

  const newPoints = user.points - request.points_used;

  await supabase
    .from("users")
    .update({ points: newPoints })
    .eq("id", user.id);

 // 3. convert to session (FIXED)

// 🎯 your dynamic formula
const convertPointsToMinutes = (points) => {
  return Math.round(
    0.004666 * points * points -
    0.03333 * points +
    6.8
  );
};

const minutes = convertPointsToMinutes(request.points_used);


  // 4. mark request as approved
  await supabase
    .from("redeem_requests")
    .update({ status: "approved" })
    .eq("id", request_id);

  return Response.json({ success: true });
}