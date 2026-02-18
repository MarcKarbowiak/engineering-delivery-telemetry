interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
}

export function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <article className="card metric-card">
      <p className="metric-title">{title}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-subtitle">{subtitle}</p>
    </article>
  );
}