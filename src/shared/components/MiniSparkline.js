"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

/**
 * A tiny sparkline. Single series, no axes or labels, so it reads as a
 * 1-pixel-thick line at the bottom of a stat tile.
 *
 * Pass `points` as a numeric array; the chart auto-scales the y axis. If the
 * series is empty, renders a flat baseline so the tile's height doesn't pop
 * in and out as data comes in.
 */
export default function MiniSparkline({
  points = [],
  color = "var(--chart-line)",
  fill = color,
  fillOpacity = 0.12,
  className,
}) {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const data = points.length
    ? points.map((value, index) => ({ i: index, value: Number(value) || 0 }))
    : [{ i: 0, value: 0 }, { i: 1, value: 0 }];

  return (
    <ResponsiveContainer width="100%" height="100%" className={className}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={fill} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          fillOpacity={1}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
