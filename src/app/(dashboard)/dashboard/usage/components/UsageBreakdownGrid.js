"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import Card from "@/shared/components/Card";
import SegmentedControl from "@/shared/components/SegmentedControl";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const COMPACT_FORMAT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const VISIBLE_ROWS = 8;

function valueFor(row, mode) {
  return mode === "cost"
    ? Number(row.cost) || 0
    : (Number(row.promptTokens) || 0) + (Number(row.completionTokens) || 0);
}

function formatValue(value, mode) {
  return mode === "cost" ? `$${Number(value).toFixed(value > 0 && value < 0.01 ? 4 : 2)}` : COMPACT_FORMAT.format(value);
}

function rowsFromObject(data, labelKey = "name") {
  return Object.entries(data || {})
    .map(([key, row]) => ({ ...row, [labelKey]: row[labelKey] || row.rawModel || row.endpoint || row.accountName || row.provider || key }))
    .filter((row) => valueFor(row, "tokens") > 0 || valueFor(row, "cost") > 0);
}

/**
 * Ranked share list. It replaced a five-slice donut next to a table repeating
 * the same numbers: angles are hard to compare, everything past the fifth row
 * was invisible in the chart, and the toggle changed the donut but not the
 * table's order. Here the bar, the order and the percentage all follow the
 * selected measure, and the tail is folded into one "Other" row.
 */
function AllocationCard({ title, rows, labelKey, columnLabel }) {
  const [mode, setMode] = useState("tokens");
  const sorted = [...rows].sort((a, b) => valueFor(b, mode) - valueFor(a, mode));
  const total = sorted.reduce((sum, row) => sum + valueFor(row, mode), 0);
  const head = sorted.slice(0, VISIBLE_ROWS);
  const tail = sorted.slice(VISIBLE_ROWS);
  const display = tail.length
    ? [...head, tail.reduce((other, row) => ({
      [labelKey]: `Other (${tail.length})`,
      isOther: true,
      requests: other.requests + (Number(row.requests) || 0),
      promptTokens: other.promptTokens + (Number(row.promptTokens) || 0),
      completionTokens: other.completionTokens + (Number(row.completionTokens) || 0),
      cost: other.cost + (Number(row.cost) || 0),
    }), { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0 })]
    : head;
  const max = head.length ? valueFor(head[0], mode) : 0;

  return (
    <Card padding="none" className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="font-mono text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
            {formatValue(total, mode)} {mode === "cost" ? "total" : "tokens total"}
          </p>
        </div>
        <SegmentedControl
          size="sm"
          options={[{ value: "tokens", label: "By token" }, { value: "cost", label: "By cost" }]}
          value={mode}
          onChange={setMode}
        />
      </div>
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[460px] text-left text-xs">
          <thead className="thead-data">
            <tr>
              <th scope="col" className="px-4 py-2">{columnLabel}</th>
              <th scope="col" className="w-[38%] px-2 py-2">Share of {mode === "cost" ? "cost" : "tokens"}</th>
              <th scope="col" className="px-2 py-2 text-right">Requests</th>
              <th scope="col" className="px-2 py-2 text-right">Tokens</th>
              <th scope="col" className="px-4 py-2 text-right">Cost</th>
            </tr>
          </thead>
          <tbody className="tbody-data">
            {display.map((row) => {
              const value = valueFor(row, mode);
              const share = total > 0 ? (value / total) * 100 : 0;
              const barWidth = max > 0 ? Math.max(1.5, (value / max) * 100) : 0;
              return (
                <tr key={`${row[labelKey]}-${row.requests}`}>
                  <td className={`max-w-[200px] truncate px-4 py-2 font-mono ${row.isOther ? "text-muted-foreground" : "text-foreground"}`} title={row[labelKey]}>
                    {row[labelKey]}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 flex-1 bg-surface-2" aria-hidden="true">
                        <span
                          className={`block h-2 ${row.isOther ? "bg-muted-foreground/40" : "bg-primary"}`}
                          style={{ width: `${row.isOther ? share : barWidth}%` }}
                        />
                      </span>
                      <span className="w-11 shrink-0 text-right font-mono tabular-nums text-muted-foreground">{share.toFixed(share >= 10 ? 0 : 1)}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">{NUMBER_FORMAT.format(row.requests || 0)}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-foreground">{COMPACT_FORMAT.format((Number(row.promptTokens) || 0) + (Number(row.completionTokens) || 0))}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground">${(Number(row.cost) || 0).toFixed(4)}</td>
                </tr>
              );
            })}
            {!display.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No data in this period</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

AllocationCard.propTypes = {
  title: PropTypes.string.isRequired,
  rows: PropTypes.array.isRequired,
  labelKey: PropTypes.string.isRequired,
  columnLabel: PropTypes.string.isRequired,
};

export default function UsageBreakdownGrid({ stats }) {
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <AllocationCard title="Allocation by model" rows={rowsFromObject(stats.byModel)} labelKey="rawModel" columnLabel="Model" />
      <AllocationCard title="Allocation by account" rows={rowsFromObject(stats.byAccount, "accountName")} labelKey="accountName" columnLabel="Account" />
      <AllocationCard title="Allocation by endpoint" rows={rowsFromObject(stats.byEndpoint, "endpoint")} labelKey="endpoint" columnLabel="Endpoint" />
    </div>
  );
}

UsageBreakdownGrid.propTypes = { stats: PropTypes.object.isRequired };
