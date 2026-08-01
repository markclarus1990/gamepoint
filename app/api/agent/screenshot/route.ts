import { StationRepository } from "@/lib/repositories/StationRepository";
import { supabase } from "@/lib/supabase";

const stationRepo = new StationRepository();
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const agentKey = req.headers.get("x-agent-key");
  if (!agentKey) {
    return Response.json({ error: "Missing agent key" }, { status: 401 });
  }

  const station = await stationRepo.findByKey(agentKey);
  if (!station) {
    return Response.json({ error: "Invalid agent key" }, { status: 401 });
  }

  const { image } = await req.json();
  if (typeof image !== "string" || !image) {
    return Response.json({ error: "Missing image" }, { status: 400 });
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(image, "base64");
  } catch {
    return Response.json({ error: "Invalid image data" }, { status: 400 });
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Image too large" }, { status: 413 });
  }

  const path = `${station.id}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("station-shots")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/station-shots/${path}`;
  await stationRepo.saveScreenshot(station.id, url);

  return Response.json({ success: true, url });
}
