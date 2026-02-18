import assert from "node:assert/strict";
import type { DeliveryEvent } from "@packages/event-model";
import {
  buildLeadTimeDistribution,
  buildMetricsResponse,
  createWindow,
  parseWindowParam
} from "../src/metrics.js";
import { normalizeEvent } from "../src/normalizer.js";

function event(partial: Partial<DeliveryEvent>): DeliveryEvent {
  return {
    id: partial.id ?? `evt-${Math.random().toString(16).slice(2)}`,
    type: partial.type ?? "commit",
    timestamp: partial.timestamp ?? new Date("2026-01-01T00:00:00Z"),
    service: partial.service ?? "payments",
    environment: partial.environment,
    commitId: partial.commitId,
    correlationId: partial.correlationId
  };
}

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [];
function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

test("parseWindowParam defaults and cap", () => {
  assert.equal(parseWindowParam(undefined), 7);
  assert.equal(parseWindowParam("bad"), 7);
  assert.equal(parseWindowParam("0d"), 7);
  assert.equal(parseWindowParam("120d"), 90);
});

test("buildMetricsResponse composes key payload fields", () => {
  const now = new Date("2026-01-08T00:00:00Z");
  const window = createWindow(now, 7);

  const events: DeliveryEvent[] = [
    event({ type: "commit", commitId: "c1", timestamp: new Date("2026-01-02T01:00:00Z") }),
    event({ type: "deployment_succeeded", commitId: "c1", timestamp: new Date("2026-01-02T03:00:00Z") }),
    event({ type: "deployment_failed", timestamp: new Date("2026-01-03T03:00:00Z") }),
    event({ type: "incident_opened", correlationId: "i1", timestamp: new Date("2026-01-03T04:00:00Z") }),
    event({ type: "incident_resolved", correlationId: "i1", timestamp: new Date("2026-01-03T05:00:00Z") })
  ];

  const response = buildMetricsResponse(events, window, 7);
  assert.equal(response.window.label, "7d");
  assert.ok(response.metrics.deploymentFrequency > 0);
  assert.ok(Math.abs(response.metrics.changeFailureRate - 0.5) < 1e-9);
  assert.equal(response.leadTimeDistribution.length, 5);
});

test("buildLeadTimeDistribution bins samples", () => {
  const window = {
    start: new Date("2026-01-01T00:00:00Z"),
    end: new Date("2026-01-03T00:00:00Z")
  };

  const events: DeliveryEvent[] = [
    event({ type: "commit", commitId: "a", timestamp: new Date("2026-01-01T00:00:00Z") }),
    event({ type: "deployment_succeeded", commitId: "a", timestamp: new Date("2026-01-01T00:30:00Z") }),
    event({ type: "commit", commitId: "b", timestamp: new Date("2026-01-01T00:00:00Z") }),
    event({ type: "deployment_succeeded", commitId: "b", timestamp: new Date("2026-01-01T05:00:00Z") })
  ];

  const distribution = buildLeadTimeDistribution(events, window);
  assert.equal(distribution.find((bucket) => bucket.bucket === "<1h")?.count, 1);
  assert.equal(distribution.find((bucket) => bucket.bucket === "4-12h")?.count, 1);
});

test("normalizeEvent validates and normalizes", () => {
  const normalized = normalizeEvent({
    id: "x",
    type: "commit",
    timestamp: "2026-01-01T00:00:00.000Z",
    service: "payments"
  });
  assert.equal(normalized.timestamp instanceof Date, true);

  assert.throws(() =>
    normalizeEvent({
      id: "x",
      type: "not_real",
      timestamp: "2026-01-01T00:00:00.000Z",
      service: "payments"
    })
  );
});

let failures = 0;
for (const { name, run } of tests) {
  try {
    await run();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL: ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exit(1);
}