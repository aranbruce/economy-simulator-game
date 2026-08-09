import type { NextRequest } from "next/server";
import { getRoom } from "../../../../../lib/mp/roomStore.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const token = request.nextUrl.searchParams.get("token") || "";
  const room = await getRoom(code, token);
  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }
  return Response.json({ room });
}
