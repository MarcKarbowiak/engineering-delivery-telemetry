import type { DeliveryEvent, TimeWindow } from "@packages/event-model";

export interface DoraMetrics {
  deploymentFrequency: number;
  leadTimeMs: number;
  changeFailureRate: number;
  mttrMs: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateDeploymentFrequency(
  events: DeliveryEvent[],
  window: TimeWindow
): number {
  const windowMs = window.end.getTime() - window.start.getTime();
  if (windowMs <= 0) {
    return 0;
  }

  const succeededDeployments = events.filter((event) => {
    if (event.type !== "deployment_succeeded") {
      return false;
    }

    const timestamp = event.timestamp.getTime();
    return timestamp >= window.start.getTime() && timestamp <= window.end.getTime();
  }).length;

  const windowDays = windowMs / DAY_IN_MS;
  return succeededDeployments / windowDays;
}

function associationKeys(event: DeliveryEvent): string[] {
  const keys: string[] = [];
  if (event.commitId) {
    keys.push(event.commitId);
  }
  if (event.correlationId && event.correlationId !== event.commitId) {
    keys.push(event.correlationId);
  }
  return keys;
}

export function calculateLeadTime(events: DeliveryEvent[]): number {
  return mean(calculateLeadTimeSamples(events));
}

function inWindow(timestampMs: number, window: TimeWindow): boolean {
  return timestampMs >= window.start.getTime() && timestampMs <= window.end.getTime();
}

function filterEventsByWindow(events: DeliveryEvent[], window: TimeWindow): DeliveryEvent[] {
  return events.filter((event) => inWindow(event.timestamp.getTime(), window));
}

export function calculateLeadTimeSamples(
  events: DeliveryEvent[],
  window?: TimeWindow
): number[] {
  const sortedEvents = [...events].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const earliestCommitByKey = new Map<string, number>();
  const leadTimes: number[] = [];

  for (const event of sortedEvents) {
    const keys = associationKeys(event);

    if (event.type === "commit" && keys.length > 0) {
      if (window && event.timestamp.getTime() > window.end.getTime()) {
        continue;
      }

      const timestamp = event.timestamp.getTime();
      for (const key of keys) {
        const current = earliestCommitByKey.get(key);
        if (current === undefined || timestamp < current) {
          earliestCommitByKey.set(key, timestamp);
        }
      }
      continue;
    }

    if (event.type !== "deployment_succeeded" || keys.length === 0) {
      continue;
    }

    const deploymentTs = event.timestamp.getTime();
    if (window && !inWindow(deploymentTs, window)) {
      continue;
    }

    const candidateCommitTimes = keys
      .map((key) => earliestCommitByKey.get(key))
      .filter((value): value is number => value !== undefined);
    const commitTs = candidateCommitTimes.length > 0 ? Math.min(...candidateCommitTimes) : undefined;
    if (commitTs === undefined) {
      continue;
    }

    if (deploymentTs >= commitTs) {
      leadTimes.push(deploymentTs - commitTs);
    }
  }

  return leadTimes;
}

export function calculateChangeFailureRate(events: DeliveryEvent[]): number {
  const deployments = events.filter(
    (event) =>
      event.type === "deployment_succeeded" || event.type === "deployment_failed"
  );

  if (deployments.length === 0) {
    return 0;
  }

  const failed = deployments.filter(
    (event) => event.type === "deployment_failed"
  ).length;

  return failed / deployments.length;
}

export function calculateLeadTimeForWindow(
  events: DeliveryEvent[],
  window: TimeWindow
): number {
  return mean(calculateLeadTimeSamples(events, window));
}

interface OpenIncident {
  id: string;
  timestampMs: number;
  resolved: boolean;
}

export function calculateMTTR(events: DeliveryEvent[]): number {
  const sortedEvents = [...events].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const openByCorrelation = new Map<string, OpenIncident[]>();
  const openByService = new Map<string, OpenIncident[]>();
  const durations: number[] = [];

  for (const event of sortedEvents) {
    if (event.type === "incident_opened") {
      const incident: OpenIncident = {
        id: event.id,
        timestampMs: event.timestamp.getTime(),
        resolved: false
      };

      if (!openByService.has(event.service)) {
        openByService.set(event.service, []);
      }
      openByService.get(event.service)!.push(incident);

      if (event.correlationId) {
        if (!openByCorrelation.has(event.correlationId)) {
          openByCorrelation.set(event.correlationId, []);
        }
        openByCorrelation.get(event.correlationId)!.push(incident);
      }

      continue;
    }

    if (event.type !== "incident_resolved") {
      continue;
    }

    let matched: OpenIncident | undefined;

    if (event.correlationId) {
      const candidates = openByCorrelation.get(event.correlationId) ?? [];
      matched = candidates.find((incident) => !incident.resolved);
    }

    if (!matched) {
      const serviceIncidents = openByService.get(event.service) ?? [];
      matched = serviceIncidents.find((incident) => !incident.resolved);
    }

    if (!matched) {
      continue;
    }

    matched.resolved = true;
    const resolvedTs = event.timestamp.getTime();
    if (resolvedTs >= matched.timestampMs) {
      durations.push(resolvedTs - matched.timestampMs);
    }
  }

  return mean(durations);
}

export function calculateDoraMetrics(
  events: DeliveryEvent[],
  window: TimeWindow
): DoraMetrics {
  const scoped = filterEventsByWindow(events, window);

  return {
    deploymentFrequency: calculateDeploymentFrequency(scoped, window),
    leadTimeMs: calculateLeadTimeForWindow(events, window),
    changeFailureRate: calculateChangeFailureRate(scoped),
    mttrMs: calculateMTTR(scoped)
  };
}
