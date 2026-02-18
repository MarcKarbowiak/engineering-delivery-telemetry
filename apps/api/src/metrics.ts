import type { DeliveryEvent, TimeWindow } from "@packages/event-model";
import type { DoraMetrics } from "@packages/dora-engine";
import {
  calculateDoraMetrics,
  calculateLeadTimeSamples
} from "@packages/dora-engine";
import { generateExecutiveSummary } from "@packages/reporting-engine";

interface DailyTrendPoint {
  date: string;
  deploymentFrequency: number;
  changeFailureRate: number;
  leadTimeHours: number;
}

interface LeadTimeBucket {
  bucket: string;
  count: number;
}

const HOUR_IN_MS = 60 * 60 * 1000;

export function parseWindowParam(raw: string | undefined): number {
  if (!raw) {
    return 7;
  }

  const match = raw.match(/^(\d+)d$/);
  if (!match) {
    return 7;
  }

  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 7;
  }

  return Math.min(parsed, 90);
}

export function createWindow(end: Date, days: number): TimeWindow {
  return {
    start: new Date(end.getTime() - days * 24 * HOUR_IN_MS),
    end
  };
}

function normalizeMetrics(raw: DoraMetrics) {
  return {
    deploymentFrequency: raw.deploymentFrequency,
    leadTimeHours: raw.leadTimeMs / HOUR_IN_MS,
    changeFailureRate: raw.changeFailureRate,
    mttrHours: raw.mttrMs / HOUR_IN_MS
  };
}

function formatDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDailyTrend(events: DeliveryEvent[], days: number, now: Date): DailyTrendPoint[] {
  const points: DailyTrendPoint[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayEnd = new Date(now.getTime() - offset * 24 * HOUR_IN_MS);
    const dayStart = new Date(dayEnd.getTime() - 24 * HOUR_IN_MS);
    const window: TimeWindow = { start: dayStart, end: dayEnd };
    const metrics = calculateDoraMetrics(events, window);

    points.push({
      date: formatDateUTC(dayEnd),
      deploymentFrequency: metrics.deploymentFrequency,
      changeFailureRate: metrics.changeFailureRate,
      leadTimeHours: metrics.leadTimeMs / HOUR_IN_MS
    });
  }

  return points;
}

export function buildLeadTimeDistribution(events: DeliveryEvent[], window: TimeWindow): LeadTimeBucket[] {
  const samplesHours = calculateLeadTimeSamples(events, window).map((ms) => ms / HOUR_IN_MS);

  const buckets: Array<{ label: string; min: number; max: number }> = [
    { label: "<1h", min: 0, max: 1 },
    { label: "1-4h", min: 1, max: 4 },
    { label: "4-12h", min: 4, max: 12 },
    { label: "12-24h", min: 12, max: 24 },
    { label: ">24h", min: 24, max: Number.POSITIVE_INFINITY }
  ];

  return buckets.map((bucket) => ({
    bucket: bucket.label,
    count: samplesHours.filter((hours) => hours >= bucket.min && hours < bucket.max).length
  }));
}

export function buildMetricsResponse(events: DeliveryEvent[], window: TimeWindow, days: number) {
  const rawMetrics = calculateDoraMetrics(events, window);

  return {
    window: {
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      label: `${days}d`
    },
    metrics: normalizeMetrics(rawMetrics),
    trends: buildDailyTrend(events, days, window.end),
    leadTimeDistribution: buildLeadTimeDistribution(events, window)
  };
}

export function buildSummaryResponse(
  events: DeliveryEvent[],
  currentWindow: TimeWindow,
  previousWindow: TimeWindow
) {
  const currentRaw = calculateDoraMetrics(events, currentWindow);
  const previousRaw = calculateDoraMetrics(events, previousWindow);

  return {
    current: normalizeMetrics(currentRaw),
    previous: normalizeMetrics(previousRaw),
    insights: generateExecutiveSummary(currentRaw, previousRaw)
  };
}
