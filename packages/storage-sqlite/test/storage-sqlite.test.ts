import { rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import type { DeliveryEvent } from "@packages/event-model";
import { SqliteEventStore } from "../src/index.js";

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

test("SqliteEventStore persists and retrieves events", async () => {
  const dbPath = path.join(tmpdir(), `telemetry-${Date.now()}-${Math.random()}.db`);
  const store = new SqliteEventStore(dbPath);

  await store.init();

  const events: DeliveryEvent[] = [
    event({ id: "1", type: "commit", timestamp: new Date("2026-01-01T00:00:00Z") }),
    event({
      id: "2",
      type: "deployment_succeeded",
      timestamp: new Date("2026-01-01T01:00:00Z"),
      environment: "production",
      commitId: "c1"
    })
  ];

  await store.insertEvents(events);
  assert.equal(await store.countEvents(), 2);

  const listed = await store.listEvents();
  assert.equal(listed.length, 2);
  assert.equal(listed[1].environment, "production");

  await store.close();
  await rm(dbPath, { force: true });
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