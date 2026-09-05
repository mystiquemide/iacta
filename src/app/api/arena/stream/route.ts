import { readEngineArenaState } from "@/lib/arena";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 2_000;

const encoder = new TextEncoder();

function arenaEvent(data: unknown): Uint8Array {
  return encoder.encode(`event: arena\ndata: ${JSON.stringify(data)}\n\n`);
}

function errorEvent(): Uint8Array {
  return encoder.encode(
    `event: error\ndata: ${JSON.stringify({
      message: "Arena state is temporarily unavailable.",
    })}\n\n`,
  );
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

      const send = async () => {
        if (closed) return;
        try {
          const state = await readEngineArenaState();
          if (closed) return;
          controller.enqueue(arenaEvent(state));
        } catch {
          try {
            controller.enqueue(errorEvent());
          } catch {
            // The stream is already closed. Cleanup below.
          }
          close();
        }
      };

      const interval = setInterval(send, POLL_INTERVAL_MS);
      request.signal.addEventListener("abort", close, { once: true });
      void send();
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
