import type { NextRequest } from "next/server";
import { joinRoom } from "../../../../../../lib/mp/roomStore.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await joinRoom(code, {
    name: body.name,
    role: body.role,
  });
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result);
}
