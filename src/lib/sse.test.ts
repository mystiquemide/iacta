import assert from "node:assert/strict";
import test from "node:test";
import { sendSseEvent, type SseController } from "./sse.js";

test("SSE send never throws when the stream controller rejects the error frame", () => {
  let enqueueCount = 0;
  const controller: SseController = {
    enqueue() {
      enqueueCount += 1;
      throw new Error("controller is closed");
    },
  };

  assert.doesNotThrow(() => {
    assert.equal(sendSseEvent(controller, "arena", { ok: true }), false);
  });
  assert.equal(enqueueCount, 2);
});
