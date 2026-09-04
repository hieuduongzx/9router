"use client";

import PropTypes from "prop-types";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "@/shared/components/Card";
import SectionLabel from "@/shared/components/SectionLabel";
import { CHART_RAMP, CHART_GRID, CHART_TICK, CHART_TOOLTIP_LABEL, CHART_TOOLTIP_STYLE } from "@/shared/utils/chartTheme";

const SERIES = [
  { key: "promptTokens", name: "Input", color: CHART_RAMP[0], fill: CHART_RAMP[0], fillOpacity: 0.1, swatch: "bg-chart-1" },
  { key: "completionTokens", name: "Output", color: CHART_RAMP[1], fill: CHART_RAMP[1], fillOpacity: 0.1, swatch: "bg-chart-2" },
  { key: "cacheCreation", name: "Cache Creation", color: CHART_RAMP[2], fill: CHART_RAMP[2], fillOpacity: 0.08, swatch: "bg-chart-3" },
  { key: "cacheRead", name: "Cache Read", color: CHART_RAMP[3], fill: CHART_RAMP[3], fillOpacity: 0.2, swatch: "bg-chart-4" },
];
const RATE_LINE = { key: "cacheHitRate", name: "Cache Hit Rate", color: CHART_RAMP[4], swatch: "bg-chart-5" };

const fmt = (value) => {
  const number = Number(value) || 0;
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return String(number);
};

export default function SageTokenTrend({ points = [] }) {
  return (
    <Card padding="none" className="min-w-0 overflow-hidden">
      <div className="border-b border-border px-5 py-3.5">
        <SectionLabel className="!mb-0">Xu hướng sử dụng Token</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {[...SERIES, RATE_LINE].map((item) => (
            <span key={item.name} className="inline-flex items-center gap-1.5"><span className={`size-2 ${item.swatch}`} />{item.name}</span>
          ))}
        </div>
      </div>
      <div className="h-[310px] p-4 sm:h-[360px]">
        {points.length ? <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} {...CHART_GRID} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={CHART_TICK} tickMargin={8} interval="preserveStartEnd" />
            <YAxis yAxisId="tokens" tickLine={false} axisLine={false} tick={CHART_TICK} tickFormatter={fmt} width={42} />
            <YAxis yAxisId="rate" orientation="right" domain={[0, 1]} tickLine={false} axisLine={false} tick={CHART_TICK} tickFormatter={(value) => `${Math.round(value * 100)}%`} width={34} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL} formatter={(value, name) => [name === "Cache Hit Rate" ? `${Math.round(Number(value) * 100)}%` : fmt(value), name]} />
            {SERIES.map((s) => (
              <Area key={s.key} yAxisId="tokens" type="monotone" dataKey={s.key} name={s.name} stroke={s.color} fill={s.fill} fillOpacity={s.fillOpacity} strokeWidth={1.5} isAnimationActive={false} />
            ))}
            <Line yAxisId="rate" type="monotone" dataKey={RATE_LINE.key} name={RATE_LINE.name} stroke={RATE_LINE.color} strokeDasharray="5 5" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Không có dữ liệu trong khoảng thời gian này.</div>}
      </div>
    </Card>
  );
}

SageTokenTrend.propTypes = { points: PropTypes.array };
