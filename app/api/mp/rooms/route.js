import { createRoom } from "../../../../lib/mp/roomStore.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = createRoom({
      hostName: body.hostName,
      role: body.role,
    });
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err.message || "Failed to create room" },
      { status: 500 }
    );
  }
}
