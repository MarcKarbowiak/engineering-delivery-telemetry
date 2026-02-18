interface BarChartDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  title: string;
  data: BarChartDatum[];
  formatter?: (value: number) => string;
}

export function BarChart({ title, data, formatter }: BarChartProps) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <section className="card chart-card">
      <h3>{title}</h3>
      <div className="bars">
        {data.map((item) => {
          const height = (item.value / max) * 100;
          return (
            <div key={item.label} className="bar-group">
              <div className="bar" style={{ height: `${Math.max(height, 2)}%` }} />
              <span>{item.label}</span>
              <small>{formatter ? formatter(item.value) : item.value.toFixed(2)}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}