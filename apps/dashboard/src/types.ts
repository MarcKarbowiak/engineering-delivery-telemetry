export interface MetricSnapshot {
  deploymentFrequency: number;
  leadTimeHours: number;
  changeFailureRate: number;
  mttrHours: number;
}

export interface TrendPoint {
  date: string;
  deploymentFrequency: number;
  changeFailureRate: number;
  leadTimeHours: number;
}

export interface LeadTimeBucket {
  bucket: string;
  count: number;
}

export interface MetricsResponse {
  window: {
    start: string;
    end: string;
    label: string;
  };
  metrics: MetricSnapshot;
  trends: TrendPoint[];
  leadTimeDistribution: LeadTimeBucket[];
}

export interface SummaryInsight {
  area: "deployment_frequency" | "lead_time" | "cfr" | "mttr";
  trend: "improving" | "degrading" | "stable";
  deltaPercent: number;
  recommendation: string;
}

export interface SummaryResponse {
  current: MetricSnapshot;
  previous: MetricSnapshot;
  insights: SummaryInsight[];
}