import type { SummaryInsight } from "../types";

interface SummaryPanelProps {
  insights: SummaryInsight[];
}

function labelForArea(area: SummaryInsight["area"]): string {
  switch (area) {
    case "deployment_frequency":
      return "Deployment Frequency";
    case "lead_time":
      return "Lead Time";
    case "cfr":
      return "Change Failure Rate";
    case "mttr":
      return "MTTR";
    default:
      return "Unknown";
  }
}

export function SummaryPanel({ insights }: SummaryPanelProps) {
  return (
    <section className="card summary-card">
      <h3>Executive Summary</h3>
      {insights.length === 0 ? (
        <p className="empty">No summary available.</p>
      ) : (
        <ul>
          {insights.map((insight) => (
            <li key={insight.area}>
              <strong>{labelForArea(insight.area)}:</strong> {insight.trend} ({insight.deltaPercent.toFixed(1)}%) - {insight.recommendation}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
