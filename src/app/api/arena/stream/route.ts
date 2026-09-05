import { readArenaState } from "@/lib/arena-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();
const POLL_INTERVAL_MS = 2_000;

function eventPayload(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function GET(request: Request): Response {
  let closeStream: () => void = () => undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        request.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          // The client may already have cancelled the stream.
        }
      };
      closeStream = close;

      const send = () => {
        if (closed) return;
        try {
          controller.enqueue(eventPayload("arena", readArenaState()));
        } catch {
          controller.enqueue(eventPayload("error", { message: "Arena state is temporarily unavailable." }));
        }
      };

      const interval = setInterval(send, POLL_INTERVAL_MS);
      request.signal.addEventListener("abort", close, { once: true });
      send();
    },
    cancel() {
      closeStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}
