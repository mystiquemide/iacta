import { readArenaState } from "@/lib/arena-server";
import { sendSseEvent } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 2_000;

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
        if (!sendSseEvent(controller, "arena", readArenaState())) close();
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
