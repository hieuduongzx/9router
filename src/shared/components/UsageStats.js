"use client";

import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import OverviewCards from "@/app/(dashboard)/dashboard/usage/components/OverviewCards";
import RequestDetailsTab from "@/app/(dashboard)/dashboard/usage/components/RequestDetailsTab";
import UsageTrendSection from "@/app/(dashboard)/dashboard/usage/components/UsageTrendSection";
import {
  normalizeUsageChartPoints,
  normalizeUsageChartSeries,
} from "@/shared/utils/usageChart";
import { PeriodDropdown } from "@/shared/components";
import { Icon } from "@/shared/components/ui/icon";

export default function UsageStats({
  period: periodProp,
  setPeriod: setPeriodProp,
  apiKeyId: apiKeyIdProp = "all",
  hidePeriodSelector = false,
} = {}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [chartPoints, setChartPoints] = useState([]);
  const [chartSeries, setChartSeries] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartFetching, setChartFetching] = useState(false);
  const [chartError, setChartError] = useState("");
  const [periodLocal, setPeriodLocal] = useState("24h");
  const isInitialLoad = useRef(true);
  const hasLoadedChart = useRef(false);
  const period = periodProp ?? periodLocal;
  const setPeriod = setPeriodProp ?? setPeriodLocal;
  const apiKeyId = apiKeyIdProp || "all";

  useEffect(() => {
    const controller = new AbortController();
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      setLoading(true);
    } else {
      setFetching(true);
    }

    const params = new URLSearchParams({ period });
    if (apiKeyId !== "all") params.set("apiKeyId", apiKeyId);
    fetch(`/api/usage/stats?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Unable to load model usage");
        setStats(data);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setStats(null);
      })
      .finally(() => {
        setLoading(false);
        setFetching(false);
      });
    return () => controller.abort();
  }, [period, apiKeyId]);

  useEffect(() => {
    const controller = new AbortController();
    const isRefetch = hasLoadedChart.current;
    if (isRefetch) setChartFetching(true);
    else setChartLoading(true);

    const params = new URLSearchParams({ period });
    if (apiKeyId !== "all") params.set("apiKeyId", apiKeyId);
    fetch(`/api/usage/chart?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Unable to load usage charts");
        setChartPoints(normalizeUsageChartPoints(data));
        setChartSeries(normalizeUsageChartSeries(data));
        setChartError("");
        hasLoadedChart.current = true;
      })
      .catch((reason) => {
        if (reason?.name === "AbortError") return;
        setChartError(reason.message || "Unable to load usage charts");
        if (!isRefetch) {
          setChartPoints([]);
          setChartSeries([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setChartLoading(false);
          setChartFetching(false);
        }
      });
    return () => controller.abort();
  }, [period, apiKeyId]);

  if (!stats && !loading) {
    return <div role="alert" className="rounded-sm border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">Model usage could not be loaded.</div>;
  }

  const spinner = (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Icon name="progress_activity" className="animate-spin size-[32px]" />
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {!hidePeriodSelector && (
        <div className="flex w-full items-center gap-2 sm:w-auto sm:self-end">
          <PeriodDropdown value={period} onChange={setPeriod} disabled={fetching} />
          {fetching && <Icon name="progress_activity" className="animate-spin size-[16px] text-muted-foreground" />}
        </div>
      )}

      {loading ? spinner : <OverviewCards stats={stats} />}

      <UsageTrendSection
        points={chartPoints}
        series={chartSeries}
        loading={chartLoading}
        fetching={chartFetching}
        error={chartError}
      />

      {loading ? spinner : <RequestDetailsTab period={period} apiKeyId={apiKeyId} />}
    </div>
  );
}

UsageStats.propTypes = {
  period: PropTypes.string,
  setPeriod: PropTypes.func,
  apiKeyId: PropTypes.string,
  hidePeriodSelector: PropTypes.bool,
};
