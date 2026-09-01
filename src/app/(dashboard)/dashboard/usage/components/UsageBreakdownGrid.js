"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import Card from "@/shared/components/Card";
import SegmentedControl from "@/shared/components/SegmentedControl";

const COLORS = ["#2563eb", "#60a5fa", "#93c5fd", "#cbd5e1", "#94a3b8"];
const NUMBER_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const COMPACT_FORMAT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

function valueFor(row, mode) {
  return mode === "cost"
    ? Number(row.cost) || 0
    : (Number(row.promptTokens) || 0) + (Number(row.completionTokens) || 0);
}

function rowsFromObject(data, labelKey = "name") {
  return Object.entries(data || {})
    .map(([key, row]) => ({ ...row, [labelKey]: row[labelKey] || row.rawModel || row.endpoint || row.accountName || row.provider || key }))
    .filter((row) => valueFor(row, "tokens") > 0 || valueFor(row, "cost") > 0)
    .sort((a, b) => valueFor(b, "tokens") - valueFor(a, "tokens"));
}

function AllocationCard({ title, rows, labelKey }) {
  const [mode, setMode] = useState("tokens");
  const total = rows.reduce((sum, row) => sum + valueFor(row, mode), 0);
  const chartRows = rows.slice(0, 5);
  const chartData = chartRows.map((row, index) => ({
    name: row[labelKey],
    value: valueFor(row, mode),
    color: COLORS[index % COLORS.length],
  }));

  return (
    <Card padding="none" className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="font-mono text-sm font-semibold text-foreground">{title}</h2>
        <SegmentedControl
          size="sm"
          options={[{ value: "tokens", label: "Theo Token" }, { value: "cost", label: "Theo Chi phí thực tế" }]}
          value={mode}
          onChange={setMode}
        />
      </div>
      <div className="grid min-w-0 grid-cols-[150px_minmax(0,1fr)] gap-3 p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="relative h-40 min-w-0">
          {chartData.length ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" innerRadius={43} outerRadius={63} stroke="none" isAnimationActive={false}>
                    {chartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [mode === "cost" ? `$${Number(value).toFixed(4)}` : COMPACT_FORMAT.format(value), mode === "cost" ? "Thực tế" : "Token"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-sm font-semibold text-foreground">{mode === "cost" ? `$${total.toFixed(2)}` : COMPACT_FORMAT.format(total)}</span>
                <span className="text-[10px] text-muted-foreground">{mode === "cost" ? "USD" : "token"}</span>
              </div>
            </>
          ) : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Không có dữ liệu</div>}
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-[11px]">
            <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-2 py-2">{labelKey === "endpoint" ? "Endpoint" : labelKey === "accountName" ? "Nhóm" : "Model"}</th><th className="px-2 py-2 text-right">Yêu cầu</th><th className="px-2 py-2 text-right">Token</th><th className="px-2 py-2 text-right">Thực tế</th></tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.slice(0, 6).map((row) => <tr key={`${row[labelKey]}-${row.requests}`}>
                <td className="max-w-[170px] truncate px-2 py-2 font-mono text-foreground" title={row[labelKey]}>{row[labelKey]}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">{NUMBER_FORMAT.format(row.requests || 0)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-foreground">{COMPACT_FORMAT.format((Number(row.promptTokens) || 0) + (Number(row.completionTokens) || 0))}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-foreground">${(Number(row.cost) || 0).toFixed(4)}</td>
              </tr>)}
              {!rows.length && <tr><td colSpan={4} className="px-2 py-8 text-center text-muted-foreground">Không có dữ liệu</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

AllocationCard.propTypes = { title: PropTypes.string.isRequired, rows: PropTypes.array.isRequired, labelKey: PropTypes.string.isRequired };

export default function UsageBreakdownGrid({ stats }) {
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <AllocationCard title="Phân bổ theo Model" rows={rowsFromObject(stats.byModel)} labelKey="rawModel" />
      <AllocationCard title="Phân bổ sử dụng theo Nhóm" rows={rowsFromObject(stats.byAccount, "accountName")} labelKey="accountName" />
      <AllocationCard title="Phân bổ Endpoint" rows={rowsFromObject(stats.byEndpoint, "endpoint")} labelKey="endpoint" />
    </div>
  );
}

UsageBreakdownGrid.propTypes = { stats: PropTypes.object.isRequired };


