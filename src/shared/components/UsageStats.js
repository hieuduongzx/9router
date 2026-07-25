"use client";

import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import OverviewCards from "@/app/(dashboard)/dashboard/usage/components/OverviewCards";
import UsageOverTime from "@/app/(dashboard)/dashboard/usage/components/UsageOverTime";
import RequestDetailsTab from "@/app/(dashboard)/dashboard/usage/components/RequestDetailsTab";
import { PeriodDropdown } from "@/shared/components";

export default function UsageStats({
  period: periodProp,
  setPeriod: setPeriodProp,
  apiKeyId: apiKeyIdProp = "all",
  hidePeriodSelector = false,
} = {}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [periodLocal, setPeriodLocal] = useState("24h");
  const isInitialLoad = useRef(true);
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

  if (!stats && !loading) {
    return <div role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">Model usage could not be loaded.</div>;
  }

  const spinner = (
    <div className="flex items-center justify-center py-12 text-text-muted">
      <span className="material-symbols-outlined animate-spin text-[32px]">progress_activity</span>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {!hidePeriodSelector && (
        <div className="flex w-full items-center gap-2 sm:w-auto sm:self-end">
          <PeriodDropdown value={period} onChange={setPeriod} disabled={fetching} />
          {fetching && <span className="material-symbols-outlined animate-spin text-[16px] text-text-muted">progress_activity</span>}
        </div>
      )}

      {loading ? spinner : <OverviewCards stats={stats} />}

      <UsageOverTime period={period} onPeriodChange={setPeriod} apiKeyId={apiKeyId} />

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
