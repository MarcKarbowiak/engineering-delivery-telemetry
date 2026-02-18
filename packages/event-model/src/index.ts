export type DeliveryEventType =
  | "commit"
  | "pr_merged"
  | "deployment_started"
  | "deployment_succeeded"
  | "deployment_failed"
  | "incident_opened"
  | "incident_resolved";

export interface DeliveryEvent {
  id: string;
  type: DeliveryEventType;
  timestamp: Date;
  service: string;
  environment?: string;
  commitId?: string;
  correlationId?: string;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export const DEPLOYMENT_TYPES: DeliveryEventType[] = [
  "deployment_succeeded",
  "deployment_failed"
];