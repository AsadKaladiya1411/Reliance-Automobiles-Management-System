import assert from "node:assert/strict";
import test from "node:test";
import { getRuntimeMetrics } from "./runtime-metrics";

test("runtime metrics expose process and memory health fields", () => {
  const metrics = getRuntimeMetrics();

  assert.equal(typeof metrics.uptimeSeconds, "number");
  assert.equal(typeof metrics.pid, "number");
  assert.equal(typeof metrics.nodeVersion, "string");
  assert.equal(typeof metrics.timestamp, "string");
  assert.equal(typeof metrics.memory.heapUsedBytes, "number");
  assert.ok(metrics.memory.heapUsedBytes > 0);
});
