import type { NextRequest } from "next/server";
import { createRoom, mpStoreMode } from "../../../../lib/mp/roomStore.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await createRoom({
      hostName: body.hostName,
      role: body.role,
    });
    if ("error" in result) {
      return Response.json(
        { error: result.error, store: mpStoreMode() },
        { status: result.status || 500 }
      );
    }
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create room" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ store: mpStoreMode() });
}
