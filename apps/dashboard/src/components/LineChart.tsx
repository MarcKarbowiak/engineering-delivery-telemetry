interface LineChartProps {
  title: string;
  labels: string[];
  values: number[];
  formatter?: (value: number) => string;
}

export function LineChart({ title, labels, values, formatter }: LineChartProps) {
  const width = 560;
  const height = 220;
  const padding = 28;

  if (values.length === 0) {
    return (
      <section className="card chart-card">
        <h3>{title}</h3>
        <p className="empty">No data</p>
      </section>
    );
  }

  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x =
      padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
    const y = height - padding - (value / max) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <section className="card chart-card">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          points={points.join(" ")}
        />
      </svg>
      <div className="chart-footer">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
      <p className="chart-summary">
        Latest: {formatter ? formatter(values[values.length - 1]) : values[values.length - 1].toFixed(2)}
      </p>
    </section>
  );
}