import { startRoom } from "../../../../../../lib/mp/roomPlay.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const { code } = await params;
  const body = await request.json().catch(() => ({}));
  const result = startRoom(code, body.token, body.snapshot);
  if (result.error) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result);
}
