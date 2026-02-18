import type { DoraMetrics } from "@packages/dora-engine";

export interface SummaryInsight {
  area: "deployment_frequency" | "lead_time" | "cfr" | "mttr";
  trend: "improving" | "degrading" | "stable";
  deltaPercent: number;
  recommendation: string;
}

function calculateDeltaPercent(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) {
      return 0;
    }
    return 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

function classifyTrend(
  deltaPercent: number,
  betterWhenHigher: boolean
): "improving" | "degrading" | "stable" {
  if (Math.abs(deltaPercent) < 2) {
    return "stable";
  }

  if (betterWhenHigher) {
    return deltaPercent > 0 ? "improving" : "degrading";
  }

  return deltaPercent < 0 ? "improving" : "degrading";
}

function recommendationFor(
  area: SummaryInsight["area"],
  trend: SummaryInsight["trend"]
): string {
  if (area === "deployment_frequency") {
    if (trend === "improving") {
      return "Maintain release train cadence and continue trunk-based integration practices.";
    }
    if (trend === "degrading") {
      return "Reduce deployment batch size and automate promotion checks to recover cadence.";
    }
    return "Keep weekly release planning stable and watch for queue growth in pull requests.";
  }

  if (area === "lead_time") {
    if (trend === "improving") {
      return "Sustain fast review loops and keep CI cycle times below team SLA targets.";
    }
    if (trend === "degrading") {
      return "Target long-running review queues and CI bottlenecks with explicit WIP limits.";
    }
    return "Monitor review wait time and handoff latency to prevent lead-time drift.";
  }

  if (area === "cfr") {
    if (trend === "improving") {
      return "Preserve deployment quality gates and continue post-deploy verification checks.";
    }
    if (trend === "degrading") {
      return "Increase pre-release test depth and add canary rollback policies for risky services.";
    }
    return "Keep release quality controls steady and review high-risk change patterns monthly.";
  }

  if (trend === "improving") {
    return "Capture and standardize recovery playbooks while incident response is trending positively.";
  }
  if (trend === "degrading") {
    return "Prioritize incident triage automation and define strict on-call escalation handoffs.";
  }
  return "Maintain incident drills and track response-time variance by service ownership.";
}

export function generateExecutiveSummary(
  current: DoraMetrics,
  previous: DoraMetrics
): SummaryInsight[] {
  const rows: Array<{
    area: SummaryInsight["area"];
    currentValue: number;
    previousValue: number;
    betterWhenHigher: boolean;
  }> = [
    {
      area: "deployment_frequency",
      currentValue: current.deploymentFrequency,
      previousValue: previous.deploymentFrequency,
      betterWhenHigher: true
    },
    {
      area: "lead_time",
      currentValue: current.leadTimeMs,
      previousValue: previous.leadTimeMs,
      betterWhenHigher: false
    },
    {
      area: "cfr",
      currentValue: current.changeFailureRate,
      previousValue: previous.changeFailureRate,
      betterWhenHigher: false
    },
    {
      area: "mttr",
      currentValue: current.mttrMs,
      previousValue: previous.mttrMs,
      betterWhenHigher: false
    }
  ];

  return rows.map((row) => {
    const deltaPercent = calculateDeltaPercent(row.currentValue, row.previousValue);
    const trend = classifyTrend(deltaPercent, row.betterWhenHigher);

    return {
      area: row.area,
      trend,
      deltaPercent,
      recommendation: recommendationFor(row.area, trend)
    };
  });
}