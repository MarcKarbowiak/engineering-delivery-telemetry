import assert from "node:assert/strict";
import type { DoraMetrics } from "@packages/dora-engine";
import { generateExecutiveSummary } from "../src/index.js";

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [];
function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

const baseCurrent: DoraMetrics = {
  deploymentFrequency: 4,
  leadTimeMs: 6 * 60 * 60 * 1000,
  changeFailureRate: 0.08,
  mttrMs: 2 * 60 * 60 * 1000
};

const basePrevious: DoraMetrics = {
  deploymentFrequency: 2,
  leadTimeMs: 8 * 60 * 60 * 1000,
  changeFailureRate: 0.12,
  mttrMs: 3 * 60 * 60 * 1000
};

test("generateExecutiveSummary classifies trends", () => {
  const insights = generateExecutiveSummary(baseCurrent, basePrevious);
  const byArea = Object.fromEntries(insights.map((item) => [item.area, item]));

  assert.equal(byArea.deployment_frequency.trend, "improving");
  assert.equal(byArea.lead_time.trend, "improving");
  assert.equal(byArea.cfr.trend, "improving");
  assert.equal(byArea.mttr.trend, "improving");
});

test("generateExecutiveSummary marks near-zero deltas stable", () => {
  const current: DoraMetrics = {
    deploymentFrequency: 10.1,
    leadTimeMs: 100,
    changeFailureRate: 0.101,
    mttrMs: 100
  };
  const previous: DoraMetrics = {
    deploymentFrequency: 10,
    leadTimeMs: 100,
    changeFailureRate: 0.1,
    mttrMs: 100
  };

  const insights = generateExecutiveSummary(current, previous);
  assert.equal(insights.every((insight) => insight.trend === "stable"), true);
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