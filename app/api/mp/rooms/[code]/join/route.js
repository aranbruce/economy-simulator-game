import { joinRoom } from "../../../../../../lib/mp/roomStore.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const { code } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await joinRoom(code, {
    name: body.name,
    role: body.role,
  });
  if (result.error) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result);
}
