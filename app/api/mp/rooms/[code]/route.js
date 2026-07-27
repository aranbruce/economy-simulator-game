import { getRoom } from "../../../../../lib/mp/roomStore.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { code } = await params;
  const token = request.nextUrl.searchParams.get("token") || "";
  const room = getRoom(code, token);
  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }
  return Response.json({ room });
}
