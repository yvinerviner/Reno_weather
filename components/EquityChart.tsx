type EquityPoint = { cumulativeEquity: number; buyHoldEquity: number };

export default function EquityChart({
  days,
  capitalBase,
}: {
  days: EquityPoint[];
  capitalBase: number;
}) {
  if (days.length === 0) return null;

  const width = 800;
  const height = 240;
  const padding = 36;
  const topLabelSpace = 18;

  const strategyValues = days.map((d) => d.cumulativeEquity);
  const buyHoldValues = days.map((d) => d.buyHoldEquity);
  const minValue = Math.min(capitalBase, ...strategyValues, ...buyHoldValues);
  const maxValue = Math.max(capitalBase, ...strategyValues, ...buyHoldValues);
  const range = maxValue - minValue || 1;

  const xFor = (i: number) =>
    padding + (i / Math.max(days.length - 1, 1)) * (width - padding * 2);
  const yFor = (v: number) =>
    height - padding - ((v - minValue) / range) * (height - padding * 2 - topLabelSpace);

  const strategyPoints = days.map((d, i) => `${xFor(i)},${yFor(d.cumulativeEquity)}`).join(" ");
  const buyHoldPoints = days.map((d, i) => `${xFor(i)},${yFor(d.buyHoldEquity)}`).join(" ");
  const baselineY = yFor(capitalBase);
  const isUp = days[days.length - 1].cumulativeEquity >= capitalBase;

  const lastIndex = days.length - 1;
  const strategyStart = days[0].cumulativeEquity;
  const strategyEnd = days[lastIndex].cumulativeEquity;
  const buyHoldStart = days[0].buyHoldEquity;
  const buyHoldEnd = days[lastIndex].buyHoldEquity;

  const compactMoney = (n: number) =>
    `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const startOnTop = strategyStart >= buyHoldStart;
  const endOnTop = strategyEnd >= buyHoldEnd;
  const strategyColor = isUp ? "#10b981" : "#ef4444";

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-center gap-4 font-mono text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: strategyColor }}
          />
          Strategy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
          Buy &amp; hold
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60"
        preserveAspectRatio="none"
      >
        <line
          x1={padding}
          y1={baselineY}
          x2={width - padding}
          y2={baselineY}
          stroke="currentColor"
          className="text-zinc-300 dark:text-zinc-700"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
        <polyline points={buyHoldPoints} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
        <polyline points={strategyPoints} fill="none" stroke={strategyColor} strokeWidth={1.5} />

        <text
          x={padding}
          y={yFor(strategyStart) + (startOnTop ? -8 : 14)}
          fontSize="11"
          fontFamily="monospace"
          fill={strategyColor}
        >
          {compactMoney(strategyStart)}
        </text>
        <text
          x={padding}
          y={yFor(buyHoldStart) + (startOnTop ? 14 : -8)}
          fontSize="11"
          fontFamily="monospace"
          fill="#0ea5e9"
        >
          {compactMoney(buyHoldStart)}
        </text>
        <text
          x={width - padding}
          y={yFor(strategyEnd) + (endOnTop ? -8 : 14)}
          fontSize="11"
          fontFamily="monospace"
          textAnchor="end"
          fill={strategyColor}
        >
          {compactMoney(strategyEnd)}
        </text>
        <text
          x={width - padding}
          y={yFor(buyHoldEnd) + (endOnTop ? 14 : -8)}
          fontSize="11"
          fontFamily="monospace"
          textAnchor="end"
          fill="#0ea5e9"
        >
          {compactMoney(buyHoldEnd)}
        </text>
      </svg>
    </div>
  );
}
