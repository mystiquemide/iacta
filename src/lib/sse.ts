export type SseController = Pick<ReadableStreamDefaultController<Uint8Array>, "enqueue">;

const encoder = new TextEncoder();

function eventPayload(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function sendSseEvent(
  controller: SseController,
  event: string,
  data: unknown,
): boolean {
  try {
    controller.enqueue(eventPayload(event, data));
    return true;
  } catch {
    try {
      controller.enqueue(eventPayload("error", { message: "Arena state is temporarily unavailable." }));
    } catch {
      // The stream is already closed. The caller owns cleanup.
    }
    return false;
  }
}
