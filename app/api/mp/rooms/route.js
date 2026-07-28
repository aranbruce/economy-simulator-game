import { createRoom, mpStoreMode } from "../../../../lib/mp/roomStore.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await createRoom({
      hostName: body.hostName,
      role: body.role,
    });
    if (result.error) {
      return Response.json(
        { error: result.error, store: mpStoreMode() },
        { status: result.status || 500 }
      );
    }
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err.message || "Failed to create room" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ store: mpStoreMode() });
}
