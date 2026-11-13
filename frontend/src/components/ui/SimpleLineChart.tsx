"use client";

import { useState } from "react";

export type ChartPoint = { label: string; value: number };

/** A small dependency-free line chart (no charting library) — real data only,
 * a hover shows the exact point's label + value. */
export function SimpleLineChart({
  data,
  color = "var(--indigo)",
  height = 220,
}: {
  data: ChartPoint[];
  color?: string;
  height?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 600; // viewBox units — scales to container via CSS width 100%
  const padding = { top: 16, right: 12, bottom: 24, left: 12 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + innerHeight - (d.value / maxValue) * innerHeight,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0},${padding.top + innerHeight} L${points[0]?.x ?? 0},${padding.top + innerHeight} Z`;

  // Show a label every few points so the axis doesn't get crowded on 30D/90D views.
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ height, color: "var(--text-faint)" }}>
        No data for this range yet.
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="none"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#chart-fill)" stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - stepX / 2}
            y={0}
            width={Math.max(stepX, 1)}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
          />
        ))}
        {hoverIndex !== null && (
          <>
            <line
              x1={points[hoverIndex].x}
              x2={points[hoverIndex].x}
              y1={padding.top}
              y2={padding.top + innerHeight}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <circle cx={points[hoverIndex].x} cy={points[hoverIndex].y} r={4} fill={color} />
          </>
        )}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={p.x} y={height - 4} fontSize={10} fill="var(--text-faint)" textAnchor="middle">
              {p.label}
            </text>
          ) : null
        )}
      </svg>
      {hoverIndex !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${(points[hoverIndex].x / width) * 100}%`,
            top: `${(points[hoverIndex].y / height) * 100}%`,
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        >
          <p className="font-medium">{points[hoverIndex].label}</p>
          <p style={{ color }}>{points[hoverIndex].value}</p>
        </div>
      )}
    </div>
  );
}
