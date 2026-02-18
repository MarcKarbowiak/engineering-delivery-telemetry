import type { DeliveryEvent, DeliveryEventType } from "@packages/event-model";

export interface RawTelemetryEvent {
  id: string;
  type: string;
  timestamp: string | Date;
  service: string;
  environment?: string;
  commitId?: string;
  correlationId?: string;
}

const EVENT_TYPES: DeliveryEventType[] = [
  "commit",
  "pr_merged",
  "deployment_started",
  "deployment_succeeded",
  "deployment_failed",
  "incident_opened",
  "incident_resolved"
];

function isDeliveryEventType(value: string): value is DeliveryEventType {
  return EVENT_TYPES.includes(value as DeliveryEventType);
}

export function normalizeEvent(raw: RawTelemetryEvent): DeliveryEvent {
  if (!isDeliveryEventType(raw.type)) {
    throw new Error(`Unsupported event type: ${raw.type}`);
  }

  const timestamp = raw.timestamp instanceof Date ? raw.timestamp : new Date(raw.timestamp);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Invalid event timestamp for ${raw.id}`);
  }

  return {
    id: raw.id,
    type: raw.type,
    timestamp,
    service: raw.service,
    environment: raw.environment,
    commitId: raw.commitId,
    correlationId: raw.correlationId
  };
}

export function normalizeEvents(rawEvents: RawTelemetryEvent[]): DeliveryEvent[] {
  return rawEvents.map(normalizeEvent);
}