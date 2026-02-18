import { useEffect, useMemo, useState } from "react";
import { BarChart } from "./components/BarChart";
import { LineChart } from "./components/LineChart";
import { MetricCard } from "./components/MetricCard";
import { SummaryPanel } from "./components/SummaryPanel";
import type { MetricsResponse, SummaryResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const emptyMetrics: MetricsResponse = {
  window: { start: "", end: "", label: "7d" },
  metrics: {
    deploymentFrequency: 0,
    leadTimeHours: 0,
    changeFailureRate: 0,
    mttrHours: 0
  },
  trends: [],
  leadTimeDistribution: []
};

const emptySummary: SummaryResponse = {
  current: emptyMetrics.metrics,
  previous: emptyMetrics.metrics,
  insights: []
};

export default function App() {
  const [window, setWindow] = useState("7d");
  const [metrics, setMetrics] = useState<MetricsResponse>(emptyMetrics);
  const [summary, setSummary] = useState<SummaryResponse>(emptySummary);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [metricsRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/metrics?window=${window}`),
        fetch(`${API_BASE}/summary?window=${window}`)
      ]);

      const metricsJson = (await metricsRes.json()) as MetricsResponse;
      const summaryJson = (await summaryRes.json()) as SummaryResponse;

      if (!cancelled) {
        setMetrics(metricsJson);
        setSummary(summaryJson);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [window]);

  async function seedData() {
    setSeeding(true);
    try {
      await fetch(`${API_BASE}/seed`, { method: "POST" });
      const [metricsRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/metrics?window=${window}`),
        fetch(`${API_BASE}/summary?window=${window}`)
      ]);
      setMetrics((await metricsRes.json()) as MetricsResponse);
      setSummary((await summaryRes.json()) as SummaryResponse);
    } finally {
      setSeeding(false);
    }
  }

  const trendLabels = useMemo(() => metrics.trends.map((point) => point.date), [metrics.trends]);

  return (
    <main className="layout">
      <header className="topbar">
        <h1>Delivery Intelligence</h1>
        <div className="controls">
          <label htmlFor="window">Window</label>
          <select id="window" value={window} onChange={(event) => setWindow(event.target.value)}>
            <option value="7d">7d</option>
            <option value="14d">14d</option>
            <option value="30d">30d</option>
          </select>
          <button type="button" className="seed-link" onClick={seedData} disabled={seeding}>
            {seeding ? "Seeding..." : "Seed Data"}
          </button>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard
          title="Deployment Frequency"
          value={metrics.metrics.deploymentFrequency.toFixed(2)}
          subtitle="deployments/day"
        />
        <MetricCard
          title="Lead Time"
          value={metrics.metrics.leadTimeHours.toFixed(2)}
          subtitle="hours"
        />
        <MetricCard
          title="Change Failure Rate"
          value={`${(metrics.metrics.changeFailureRate * 100).toFixed(1)}%`}
          subtitle="failed deployments"
        />
        <MetricCard
          title="MTTR"
          value={metrics.metrics.mttrHours.toFixed(2)}
          subtitle="hours"
        />
      </section>

      <section className="charts-grid">
        <LineChart
          title="Deployment Frequency Trend"
          labels={trendLabels}
          values={metrics.trends.map((point) => point.deploymentFrequency)}
          formatter={(value) => `${value.toFixed(2)} /day`}
        />
        <LineChart
          title="Lead Time Trend"
          labels={trendLabels}
          values={metrics.trends.map((point) => point.leadTimeHours)}
          formatter={(value) => `${value.toFixed(2)} h`}
        />
        <BarChart
          title="Failure Rate Chart"
          data={metrics.trends.map((point) => ({
            label: point.date.slice(5),
            value: point.changeFailureRate * 100
          }))}
          formatter={(value) => `${value.toFixed(1)}%`}
        />
        <BarChart
          title="Lead Time Distribution"
          data={metrics.leadTimeDistribution.map((bucket) => ({
            label: bucket.bucket,
            value: bucket.count
          }))}
          formatter={(value) => value.toFixed(0)}
        />
      </section>

      <SummaryPanel insights={summary.insights} />
    </main>
  );
}
