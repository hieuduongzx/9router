"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import Card from "@/shared/components/Card";

const fmt = (value) => new Intl.NumberFormat().format(value || 0);
const fmtTime = (value) => value ? new Date(value).toLocaleString() : "Never";

export default function UsageTable({ title, columns, groupedData, tableType, sortBy, sortOrder, onToggleSort, viewMode, renderDetailCells, renderSummaryCells, emptyMessage }) {
  const [expanded, setExpanded] = useState(new Set());
  const valueFields = viewMode === "tokens"
    ? [["promptTokens", "Input"], ["cachedTokens", "Cached"], ["completionTokens", "Output"], ["totalTokens", "Total"]]
    : [["inputCost", "Input Cost"], ["cachedCost", "Cached Cost"], ["outputCost", "Output Cost"], ["totalCost", "Total Cost"]];
  const toggle = (key) => setExpanded((current) => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const value = (item, field) => field.toLowerCase().includes("cost")
    ? `$${(item[field] ?? (field === "totalCost" ? item.cost : 0) ?? 0).toFixed(4)}`
    : fmt(item[field]);

  return <Card className="overflow-hidden">
    {title ? <h3 className="border-b border-border p-4 font-semibold">{title}</h3> : null}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr>{columns.map((column) => <th key={column.field} className="px-4 py-3" onClick={() => onToggleSort(tableType, column.field)}>{column.label}{sortBy === column.field ? (sortOrder === "asc" ? " ↑" : " ↓") : ""}</th>)}{valueFields.map(([field, label]) => <th key={field} className="px-4 py-3 text-right" onClick={() => onToggleSort(tableType, field)}>{label}</th>)}</tr></thead>
      <tbody>{groupedData.map((group) => <>
        <tr key={group.groupKey} className="cursor-pointer border-t border-border hover:bg-bg-subtle" onClick={() => toggle(group.groupKey)}><td className="px-4 py-3">{expanded.has(group.groupKey) ? "⌄" : "›"} {group.groupKey}</td>{renderSummaryCells(group)}{valueFields.map(([field]) => <td key={field} className="px-4 py-3 text-right">{value(group.summary, field)}</td>)}</tr>
        {expanded.has(group.groupKey) && group.items.map((item) => <tr key={item.key} className="border-t border-border">{renderDetailCells(item)}{valueFields.map(([field]) => <td key={field} className="px-4 py-3 text-right">{value(item, field)}</td>)}</tr>)}
      </>)}{groupedData.length === 0 && <tr><td colSpan={columns.length + valueFields.length} className="p-8 text-center text-text-muted">{emptyMessage}</td></tr>}</tbody>
    </table></div>
  </Card>;
}

UsageTable.propTypes = {
  title: PropTypes.string.isRequired,
  columns: PropTypes.array.isRequired,
  groupedData: PropTypes.array.isRequired,
  tableType: PropTypes.string.isRequired,
  sortBy: PropTypes.string.isRequired,
  sortOrder: PropTypes.string.isRequired,
  onToggleSort: PropTypes.func.isRequired,
  viewMode: PropTypes.string.isRequired,
  renderDetailCells: PropTypes.func.isRequired,
  renderSummaryCells: PropTypes.func.isRequired,
  emptyMessage: PropTypes.string.isRequired,
};

export { fmt, fmtTime };
