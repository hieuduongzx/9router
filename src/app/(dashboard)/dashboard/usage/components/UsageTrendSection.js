"use client";

import PropTypes from "prop-types";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CHART_COLORS,
  CHART_GRID,
  CHART_TICK,
  CHART_TOOLTIP_LABEL,
  CHART_TOOLTIP_STYLE,
} from "@/shared/utils/chartTheme";
import { buildModelChartSeries, usageChartHasData } from "@/shared/utils/usageChart";
import { EmptyState, Skeleton, Spinner } from "@/shared/components";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Icon } from "@/shared/components/ui/icon";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const PRECISE_NUMBER_FORMAT = new Intl.NumberFormat("en-US");
const MONEY_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});
const CHART_MARGIN = { top: 6, right: 8, left: 0, bottom: 0 };
const TOOLTIP_CURSOR = { stroke: "var(--border)", strokeWidth: 1 };

function formatCompact(value) {
  return NUMBER_FORMAT.format(Number(value) || 0);
}
function formatNumber(value) {
  return PRECISE_NUMBER_FORMAT.format(Number(value) || 0);
}
function formatMoney(value) {
  return MONEY_FORMAT.format(Number(value) || 0);
}

function XAxisShared() {
  return (
    <XAxis
      dataKey="label"
      tickLine={false}
      axisLine={false}
      tick={CHART_TICK}
      tickMargin={8}
      interval="preserveStartEnd"
    />
  );
}

function ChartLegend({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-3 flex min-h-8 flex-wrap content-start gap-x-3 gap-y-1.5" aria-label="Chart legend">
      {items.map((item) => (
        <li
          key={item.dataKey}
          className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className="size-2 shrink-0 rounded-sm"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="max-w-36 truncate" title={item.name}>
            {item.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

ChartLegend.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      dataKey: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
    }),
  ),
};

function ChartPanel({ title, total, legend, children }) {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {total}
        </span>
      </div>
      <div className="h-[230px] min-w-0">{children}</div>
      <ChartLegend items={legend} />
    </div>
  );
}

ChartPanel.propTypes = {
  title: PropTypes.string.isRequired,
  total: PropTypes.string.isRequired,
  legend: ChartLegend.propTypes.items,
  children: PropTypes.node.isRequired,
};

function ScreenReaderTable({ points, requestSeries, costSeries }) {
  return (
    <div className="sr-only">
      <table>
        <caption>Usage over time values for the current filters</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            {requestSeries.map((item) => (
              <th key={`requests-${item.id}`} scope="col">
                Requests: {item.name}
              </th>
            ))}
            {costSeries.map((item) => (
              <th key={`cost-${item.id}`} scope="col">
                Spend: {item.name}
              </th>
            ))}
            <th scope="col">Input tokens</th>
            <th scope="col">Output tokens</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={`${point.label}-${index}`}>
              <th scope="row">{point.label}</th>
              {requestSeries.map((item) => (
                <td key={`requests-${item.id}`}>{formatNumber(point[item.dataKey])}</td>
              ))}
              {costSeries.map((item) => (
                <td key={`cost-${item.id}`}>{formatMoney(point[item.dataKey])}</td>
              ))}
              <td>{formatNumber(point.promptTokens)}</td>
              <td>{formatNumber(point.completionTokens)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

ScreenReaderTable.propTypes = {
  points: PropTypes.arrayOf(PropTypes.object).isRequired,
  requestSeries: PropTypes.arrayOf(PropTypes.object).isRequired,
  costSeries: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function UsageTrendSection({
  points,
  series,
  loading = false,
  fetching = false,
  error = "",
}) {
  const requestSeries = buildModelChartSeries(points, series, "requests");
  const costSeries = buildModelChartSeries(points, series, "cost");
  const totalRequests = points.reduce((sum, p) => sum + (Number(p.requests) || 0), 0);
  const totalCost = points.reduce((sum, p) => sum + (Number(p.cost) || 0), 0);
  const totalTokens = points.reduce((sum, p) => sum + (Number(p.tokens) || 0), 0);
  const tokenLegend = [
    { dataKey: "promptTokens", name: "Input", color: CHART_COLORS.input },
    { dataKey: "completionTokens", name: "Output", color: CHART_COLORS.output },
  ];
  const hasData = usageChartHasData(points);

  return (
    <Card padding="none" className="min-w-0">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle>Usage over time</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Requests, estimated spend, and tokens for the current filters.
          </p>
        </div>
        {fetching && !loading ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Spinner size="xs" /> Updating
          </span>
        ) : null}
      </CardHeader>

      <div className="px-1 pb-1">
        {loading ? (
          <div className="grid min-h-[318px] grid-cols-1 gap-px border-t bg-border md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card p-5">
                <Skeleton className="h-full w-full" />
              </div>
            ))}
          </div>
        ) : error && !hasData ? (
          <EmptyState
            icon="error"
            title="Usage charts could not be loaded"
            description={error}
            className="min-h-[318px]"
          />
        ) : !hasData ? (
          <EmptyState
            icon="monitoring"
            title="No usage in this period"
            description="Try a wider period or another API key."
            className="min-h-[318px]"
          />
        ) : (
          <div className={`relative ${fetching ? "opacity-60" : "opacity-100"} transition-opacity`}>
            {error ? (
              <div
                role="alert"
                className="border-b border-destructive/25 bg-destructive/8 px-5 py-2 text-xs text-destructive"
              >
                Showing the last loaded chart. {error}
              </div>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-3">
              <ChartPanel title="Requests by model" total={formatCompact(totalRequests)} legend={requestSeries}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={CHART_MARGIN} accessibilityLayer>
                    <CartesianGrid vertical={false} {...CHART_GRID} />
                    <XAxisShared />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={CHART_TICK}
                      tickFormatter={formatCompact}
                      width={40}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={TOOLTIP_CURSOR}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL}
                      formatter={(value, name) => [formatNumber(value), name]}
                    />
                    {requestSeries.map((item) => (
                      <Line
                        key={item.dataKey}
                        type="monotone"
                        dataKey={item.dataKey}
                        name={item.name}
                        stroke={item.color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Spend by model" total={formatMoney(totalCost)} legend={costSeries}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={CHART_MARGIN} accessibilityLayer>
                    <CartesianGrid vertical={false} {...CHART_GRID} />
                    <XAxisShared />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={CHART_TICK}
                      tickFormatter={(value) => `$${formatCompact(value)}`}
                      width={48}
                    />
                    <Tooltip
                      cursor={TOOLTIP_CURSOR}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL}
                      formatter={(value, name) => [formatMoney(value), name]}
                    />
                    {costSeries.map((item) => (
                      <Line
                        key={item.dataKey}
                        type="monotone"
                        dataKey={item.dataKey}
                        name={item.name}
                        stroke={item.color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="All tokens" total={formatCompact(totalTokens)} legend={tokenLegend}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={points} margin={CHART_MARGIN} accessibilityLayer>
                    <CartesianGrid vertical={false} {...CHART_GRID} />
                    <XAxisShared />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={CHART_TICK}
                      tickFormatter={formatCompact}
                      width={40}
                    />
                    <Tooltip
                      cursor={TOOLTIP_CURSOR}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL}
                      formatter={(value, name) => [formatNumber(value), name]}
                    />
                    <Area
                      type="monotone"
                      dataKey="promptTokens"
                      name="Input"
                      stackId="tokens"
                      stroke={CHART_COLORS.input}
                      fill={CHART_COLORS.input}
                      fillOpacity={0.1}
                      strokeWidth={2}
                      activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="completionTokens"
                      name="Output"
                      stackId="tokens"
                      stroke={CHART_COLORS.output}
                      fill={CHART_COLORS.output}
                      fillOpacity={0.1}
                      strokeWidth={2}
                      activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>
            <ScreenReaderTable points={points} requestSeries={requestSeries} costSeries={costSeries} />
          </div>
        )}
      </div>
    </Card>
  );
}

UsageTrendSection.propTypes = {
  points: PropTypes.arrayOf(PropTypes.object).isRequired,
  series: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool,
  fetching: PropTypes.bool,
  error: PropTypes.string,
};
