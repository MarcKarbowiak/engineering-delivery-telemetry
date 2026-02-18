import assert from "node:assert/strict";
import type { DeliveryEvent } from "@packages/event-model";
import {
  calculateChangeFailureRate,
  calculateDoraMetrics,
  calculateDeploymentFrequency,
  calculateLeadTime,
  calculateMTTR
} from "../src/index.js";

function event(partial: Partial<DeliveryEvent>): DeliveryEvent {
  return {
    id: partial.id ?? `id-${Math.random().toString(16).slice(2)}`,
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

test("calculateDeploymentFrequency returns deployments per day", () => {
  const events: DeliveryEvent[] = [
    event({ type: "deployment_succeeded", timestamp: new Date("2026-01-01T10:00:00Z") }),
    event({ type: "deployment_succeeded", timestamp: new Date("2026-01-02T10:00:00Z") }),
    event({ type: "deployment_failed", timestamp: new Date("2026-01-03T10:00:00Z") })
  ];

  const metric = calculateDeploymentFrequency(events, {
    start: new Date("2026-01-01T00:00:00Z"),
    end: new Date("2026-01-03T00:00:00Z")
  });

  assert.ok(Math.abs(metric - 1) < 1e-9);
});

test("calculateLeadTime uses earliest associated commit", () => {
  const events: DeliveryEvent[] = [
    event({ type: "commit", commitId: "c1", timestamp: new Date("2026-01-01T00:00:00Z") }),
    event({ type: "commit", commitId: "c1", timestamp: new Date("2026-01-01T01:00:00Z") }),
    event({ type: "deployment_succeeded", commitId: "c1", timestamp: new Date("2026-01-01T04:00:00Z") })
  ];

  assert.equal(calculateLeadTime(events), 4 * 60 * 60 * 1000);
});

test("calculateLeadTime falls back to correlationId", () => {
  const events: DeliveryEvent[] = [
    event({ type: "commit", correlationId: "corr-42", timestamp: new Date("2026-01-01T00:00:00Z") }),
    event({ type: "deployment_succeeded", correlationId: "corr-42", timestamp: new Date("2026-01-01T03:00:00Z") })
  ];

  assert.equal(calculateLeadTime(events), 3 * 60 * 60 * 1000);
});

test("calculateChangeFailureRate computes failure ratio", () => {
  const events: DeliveryEvent[] = [
    event({ type: "deployment_succeeded" }),
    event({ type: "deployment_failed" }),
    event({ type: "deployment_failed" })
  ];

  assert.ok(Math.abs(calculateChangeFailureRate(events) - 2 / 3) < 1e-9);
});

test("calculateMTTR matches incidents by correlation/service", () => {
  const byCorrelation: DeliveryEvent[] = [
    event({ id: "i-open", type: "incident_opened", correlationId: "inc-1", timestamp: new Date("2026-01-01T00:00:00Z") }),
    event({ id: "i-resolve", type: "incident_resolved", correlationId: "inc-1", timestamp: new Date("2026-01-01T02:00:00Z") })
  ];
  assert.equal(calculateMTTR(byCorrelation), 2 * 60 * 60 * 1000);

  const byService: DeliveryEvent[] = [
    event({ id: "s-open", type: "incident_opened", service: "search", timestamp: new Date("2026-01-01T00:00:00Z") }),
    event({ id: "s-resolve", type: "incident_resolved", service: "search", timestamp: new Date("2026-01-01T01:30:00Z") })
  ];
  assert.equal(calculateMTTR(byService), 90 * 60 * 1000);
});

test("calculateDoraMetrics scopes CFR/MTTR to window and allows lead-time lookback", () => {
  const events: DeliveryEvent[] = [
    event({ type: "commit", commitId: "old-commit", timestamp: new Date("2025-12-30T22:00:00Z") }),
    event({ type: "deployment_succeeded", commitId: "old-commit", timestamp: new Date("2026-01-01T02:00:00Z") }),
    event({ type: "deployment_failed", timestamp: new Date("2026-01-01T03:00:00Z") }),
    event({ type: "incident_opened", correlationId: "x-1", timestamp: new Date("2025-12-28T00:00:00Z") }),
    event({ type: "incident_resolved", correlationId: "x-1", timestamp: new Date("2025-12-28T02:00:00Z") })
  ];

  const metrics = calculateDoraMetrics(events, {
    start: new Date("2026-01-01T00:00:00Z"),
    end: new Date("2026-01-02T00:00:00Z")
  });

  assert.ok(Math.abs(metrics.deploymentFrequency - 1) < 1e-9);
  assert.ok(Math.abs(metrics.changeFailureRate - 0.5) < 1e-9);
  assert.equal(metrics.leadTimeMs, 28 * 60 * 60 * 1000);
  assert.equal(metrics.mttrMs, 0);
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