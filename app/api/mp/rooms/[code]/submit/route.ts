import type { NextRequest } from "next/server";
import { submitBill } from "../../../../../../lib/mp/roomPlay.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await submitBill(code, body.token, body.draft, {
    rateManual: body.rateManual,
    manualRate: body.manualRate,
    sandbox: body.sandbox,
    envoys: body.envoys,
    ultimatums: body.ultimatums,
  });
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result);
}
