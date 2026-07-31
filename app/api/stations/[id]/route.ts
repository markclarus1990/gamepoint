import { StationRepository } from "@/lib/repositories/StationRepository";

const stationRepo = new StationRepository();

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Station ID is required" }, { status: 400 });
  }

  await stationRepo.remove(id);
  return Response.json({ success: true });
}
