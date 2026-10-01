"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "@/shared/components/Card";

export default function UsageChart({ period = "7d", scope }) {
  const [data, setData] = useState([]);
  const [mode, setMode] = useState("tokens");
  useEffect(() => {
    let mounted = true;
    const scopeQuery = scope ? `&scope=${scope}` : "";
    fetch(`/api/usage/chart?period=${period}${scopeQuery}`).then((response) => response.ok ? response.json() : []).then((result) => { if (mounted) setData(Array.isArray(result) ? result : result.points || []); }).catch(() => { if (mounted) setData([]); });
    return () => { mounted = false; };
  }, [period, scope]);
  const key = mode === "requests" ? "requests" : mode === "cost" ? "cost" : "tokens";
  return <Card className="flex min-w-0 flex-col gap-3 p-4">
    <div className="flex gap-2">{[["tokens", "Tokens"], ["requests", "Requests"], ["cost", "Cost"]].map(([value, label]) => <button key={value} onClick={() => setMode(value)} className={`rounded px-3 py-1 text-sm ${mode === value ? "bg-primary text-white" : "text-text-muted"}`}>{label}</button>)}</div>
    {data.length ? <ResponsiveContainer width="100%" height={220}><AreaChart data={data}><CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} /><XAxis dataKey="label" /><YAxis /><Tooltip /><Area type="monotone" dataKey={key} stroke="#6366f1" fill="#6366f122" /></AreaChart></ResponsiveContainer> : <div className="flex h-48 items-center justify-center text-sm text-text-muted">No data for this period</div>}
  </Card>;
}

UsageChart.propTypes = { period: PropTypes.string, scope: PropTypes.string };
