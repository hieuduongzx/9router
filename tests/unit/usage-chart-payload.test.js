import { describe, expect, it } from "vitest";
import { normalizeUsageChartPoints } from "../../src/shared/utils/usageChart.js";

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
});
