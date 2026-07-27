import { submitBill } from "../../../../../../lib/mp/roomPlay.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const { code } = await params;
  const body = await request.json().catch(() => ({}));
  const result = submitBill(code, body.token, body.draft, {
    rateManual: body.rateManual,
    manualRate: body.manualRate,
    sandbox: body.sandbox,
  });
  if (result.error) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result);
}
