import { describe, expect, it } from "vitest";
import { CHART_OTHER, CHART_RAMP } from "../../src/shared/utils/chartTheme.js";
import {
  buildModelChartSeries,
  normalizeUsageChartPoints,
  normalizeUsageChartSeries,
  usageChartHasData,
} from "../../src/shared/utils/usageChart.js";

describe("usage chart payload normalization", () => {
  it("reads the current chart API envelope", () => {
    const points = [{ label: "Jul 21", tokens: 42, cost: 0.01 }];

    expect(normalizeUsageChartPoints({ points, series: [] })).toBe(points);
  });

  it("keeps legacy array payloads and rejects malformed data", () => {
    const points = [{ label: "12:00", tokens: 7 }];

    expect(normalizeUsageChartPoints(points)).toBe(points);
    expect(normalizeUsageChartPoints(null)).toEqual([]);
    expect(normalizeUsageChartPoints({ points: null })).toEqual([]);
  });

  it("assigns a fixed color to each named model and a neutral Other color", () => {
    const payload = {
      series: [
        { id: "model-a", name: "Model A" },
        { id: "model-b", name: "Model B" },
        { id: "other", name: "Everything else" },
      ],
    };

    expect(normalizeUsageChartSeries(payload)).toEqual([
      { id: "model-a", name: "Model A", color: CHART_RAMP[0] },
      { id: "model-b", name: "Model B", color: CHART_RAMP[1] },
      { id: "other", name: "Everything else", color: CHART_OTHER },
    ]);
  });

  it("caps named models without cycling categorical colors", () => {
    const series = Array.from({ length: CHART_RAMP.length + 2 }, (_, index) => ({
      id: `model-${index}`,
      name: `Model ${index}`,
    }));
    series.splice(2, 0, { id: "model-0", name: "Duplicate" });
    series.push({ id: "other", name: "Other" });

    const normalized = normalizeUsageChartSeries({ series });
    const named = normalized.filter((item) => item.id !== "other");

    expect(named).toHaveLength(CHART_RAMP.length);
    expect(named.map((item) => item.color)).toEqual(CHART_RAMP);
    expect(new Set(named.map((item) => item.color)).size).toBe(named.length);
    expect(normalized.at(-1)).toEqual({ id: "other", name: "Other", color: CHART_OTHER });
  });

  it("builds request and spend series from prefixed point fields", () => {
    const points = [
      { r_alpha: 2, c_alpha: 0.25 },
      { r_alpha: 3, c_alpha: 0.75 },
    ];
    const series = [{ id: "alpha", name: "Alpha", color: CHART_RAMP[0] }];

    expect(buildModelChartSeries(points, series, "requests")).toEqual([{
      ...series[0],
      dataKey: "r_alpha",
      total: 5,
    }]);
    expect(buildModelChartSeries(points, series, "cost")).toEqual([{
      ...series[0],
      dataKey: "c_alpha",
      total: 1,
    }]);
    expect(buildModelChartSeries(points, series, "unknown")).toEqual([]);
  });

  it("detects usage values while treating empty buckets as no data", () => {
    expect(usageChartHasData([{ requests: 0, cost: 0, tokens: 0 }])).toBe(false);
    expect(usageChartHasData([{ requests: 1, cost: 0, tokens: 0 }])).toBe(true);
    expect(usageChartHasData([{ requests: 0, cost: 0.01, tokens: 0 }])).toBe(true);
    expect(usageChartHasData([{ requests: 0, cost: 0, tokens: 5 }])).toBe(true);
    expect(usageChartHasData(null)).toBe(false);
  });
});
