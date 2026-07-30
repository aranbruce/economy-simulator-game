import type { NextRequest } from "next/server";
import { loadRoom } from "../../../../../../lib/mp/roomPersist.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bound lifetime so clients reconnect (Vercel-friendly). */
const STREAM_MS = 8 * 60 * 1000;
/** Version poll — slow enough that a slow Redis GET cannot stampede. */
const POLL_MS = 2000;
const HEARTBEAT_MS = 15000;
/** How often to refresh from Redis when running a single local Node process. */
const KV_REFRESH_MS = 5000;

/**
 * GET /api/mp/rooms/[code]/stream?token=…
 * Emits SSE when room.version changes: data: {"version":N,"q":Q}
 *
 * Polls with an in-flight lock (never overlaps). Locally prefers the process
 * memory cache between occasional Redis refreshes — saves already write memory
 * first, so same-process peers see bumps without hammering Upstash.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 401 });
  }

  const room0 = await loadRoom(code);
  if (!room0) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }
  if (!room0.players[token]) {
    return Response.json({ error: "Not in this room" }, { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let lastVersion = room0.version;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let lifetimeTimer: ReturnType<typeof setTimeout> | null = null;
  let inflight = false;
  let lastKvRefresh = Date.now();
  const localDev = process.env.NODE_ENV !== "production";

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const cleanup = () => {
        closed = true;
        if (pollTimer) clearInterval(pollTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (lifetimeTimer) clearTimeout(lifetimeTimer);
        pollTimer = heartbeatTimer = lifetimeTimer = null;
      };

      send(`data: ${JSON.stringify({ version: lastVersion, q: room0.snapshot?.q ?? 0 })}\n\n`);

      const tick = async () => {
        if (closed || inflight) return;
        inflight = true;
        try {
          const now = Date.now();
          const dueKv = !localDev || now - lastKvRefresh >= KV_REFRESH_MS;
          if (dueKv) lastKvRefresh = now;
          const room = await loadRoom(code, {
            preferMemory: localDev && !dueKv,
          });
          if (!room || !room.players[token]) {
            send(`event: end\ndata: ${JSON.stringify({ reason: "gone" })}\n\n`);
            cleanup();
            try {
              controller.close();
            } catch {
              /* already closed */
            }
            return;
          }
          if (room.version !== lastVersion) {
            lastVersion = room.version;
            send(
              `data: ${JSON.stringify({
                version: room.version,
                q: room.snapshot ? room.snapshot.q : 0,
              })}\n\n`
            );
          }
        } catch {
          /* keep streaming; next tick may recover */
        } finally {
          inflight = false;
        }
      };

      pollTimer = setInterval(tick, POLL_MS);
      heartbeatTimer = setInterval(() => {
        send(": heartbeat\n\n");
      }, HEARTBEAT_MS);
      lifetimeTimer = setTimeout(() => {
        send(`event: end\ndata: ${JSON.stringify({ reason: "lifetime" })}\n\n`);
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }, STREAM_MS);

      request.signal?.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (lifetimeTimer) clearTimeout(lifetimeTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
