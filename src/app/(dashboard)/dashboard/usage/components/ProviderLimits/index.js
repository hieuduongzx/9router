"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ProviderIcon from "@/shared/components/ProviderIcon";
import QuotaTable from "./QuotaTable";
import QuotaGrid from "./QuotaGrid";
import { parseQuotaData, calculatePercentage, formatResetTime } from "./utils";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import { USAGE_SUPPORTED_PROVIDERS } from "@/shared/constants/providers";

const REFRESH_INTERVAL_MS = 60000; // 60 seconds

export default function ProviderLimits() {
  const [connections, setConnections] = useState([]);
  const [quotaData, setQuotaData] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [proxyPools, setProxyPools] = useState([]);
  const [providerFilter, setProviderFilter] = useState("all");
  const [expiringFirst, setExpiringFirst] = useState(false);

  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  // Fetch all provider connections
  const fetchConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/providers/client");
      if (!response.ok) throw new Error("Failed to fetch connections");

      const data = await response.json();
      const connectionList = data.connections || [];
      setConnections(connectionList);
      return connectionList;
    } catch (error) {
      console.error("Error fetching connections:", error);
      setConnections([]);
      return [];
    }
  }, []);

  // Fetch quota for a specific connection
  const fetchQuota = useCallback(async (connectionId, provider) => {
    setLoading((prev) => ({ ...prev, [connectionId]: true }));
    setErrors((prev) => ({ ...prev, [connectionId]: null }));

    try {
      console.log(
        `[ProviderLimits] Fetching quota for ${provider} (${connectionId})`,
      );
      const response = await fetch(`/api/usage/${connectionId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || response.statusText;

        // Handle different error types gracefully
        if (response.status === 404) {
          // Connection not found - skip silently
          console.warn(
            `[ProviderLimits] Connection not found for ${provider}, skipping`,
          );
          return;
        }

        if (response.status === 401) {
          // Auth error - show message instead of throwing
          console.warn(
            `[ProviderLimits] Auth error for ${provider}:`,
            errorMsg,
          );
          setQuotaData((prev) => ({
            ...prev,
            [connectionId]: {
              quotas: [],
              message: errorMsg,
            },
          }));
          return;
        }

        throw new Error(`HTTP ${response.status}: ${errorMsg}`);
      }

      const data = await response.json();
      console.log(`[ProviderLimits] Got quota for ${provider}:`, data);

      // Parse quota data using provider-specific parser
      const parsedQuotas = parseQuotaData(provider, data);

      setQuotaData((prev) => ({
        ...prev,
        [connectionId]: {
          quotas: parsedQuotas,
          plan: data.plan || null,
          message: data.message || null,
          raw: data,
        },
      }));
    } catch (error) {
      console.error(
        `[ProviderLimits] Error fetching quota for ${provider} (${connectionId}):`,
        error,
      );
      setErrors((prev) => ({
        ...prev,
        [connectionId]: error.message || "Failed to fetch quota",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [connectionId]: false }));
    }
  }, []);

  // Refresh quota for a specific provider
  const refreshProvider = useCallback(
    async (connectionId, provider) => {
      await fetchQuota(connectionId, provider);
      setLastUpdated(new Date());
    },
    [fetchQuota],
  );

  // Refresh all providers
  const refreshAll = useCallback(async () => {
    if (refreshingAll) return;

    setRefreshingAll(true);
    setCountdown(60);

    try {
      const conns = await fetchConnections();

      // Filter only supported OAuth providers
      const oauthConnections = conns.filter(
        (conn) =>
          USAGE_SUPPORTED_PROVIDERS.includes(conn.provider) &&
          conn.authType === "oauth",
      );

      // Fetch quota for supported OAuth connections only
      await Promise.all(
        oauthConnections.map((conn) => fetchQuota(conn.id, conn.provider)),
      );

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error refreshing all providers:", error);
    } finally {
      setRefreshingAll(false);
    }
  }, [refreshingAll, fetchConnections, fetchQuota]);

  // Initial load: fetch connections first so cards render immediately, then fetch quotas
  useEffect(() => {
    const initializeData = async () => {
      setConnectionsLoading(true);
      const conns = await fetchConnections();
      setConnectionsLoading(false);

      const oauthConnections = conns.filter(
        (conn) =>
          USAGE_SUPPORTED_PROVIDERS.includes(conn.provider) &&
          conn.authType === "oauth",
      );

      // Mark all as loading before fetching
      const loadingState = {};
      oauthConnections.forEach((conn) => {
        loadingState[conn.id] = true;
      });
      setLoading(loadingState);

      await Promise.all(
        oauthConnections.map((conn) => fetchQuota(conn.id, conn.provider)),
      );
      setLastUpdated(new Date());
    };

    initializeData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    // Main refresh interval
    intervalRef.current = setInterval(() => {
      refreshAll();
    }, REFRESH_INTERVAL_MS);

    // Countdown interval
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return 60;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefresh, refreshAll]);

  // Pause auto-refresh when tab is hidden (Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      } else if (autoRefresh) {
        // Resume auto-refresh when tab becomes visible
        intervalRef.current = setInterval(refreshAll, REFRESH_INTERVAL_MS);
        countdownRef.current = setInterval(() => {
          setCountdown((prev) => (prev <= 1 ? 60 : prev - 1));
        }, 1000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoRefresh, refreshAll]);

  // Format last updated time
  const formatLastUpdated = useCallback(() => {
    if (!lastUpdated) return "Never";

    const now = new Date();
    const diffMs = now - lastUpdated;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return "Just now";
  }, [lastUpdated]);

  // Filter only supported providers
  const filteredConnections = connections.filter(
    (conn) =>
      USAGE_SUPPORTED_PROVIDERS.includes(conn.provider) &&
      conn.authType === "oauth",
  );

  const providerFilteredConnections = filteredConnections.filter(
    (conn) => providerFilter === "all" || conn.provider === providerFilter,
  );

  const getEarliestResetTime = (conn) => {
    const resetTimes = (quotaData[conn.id]?.quotas || [])
      .map((quota) => quota.resetAt ? new Date(quota.resetAt).getTime() : Number.POSITIVE_INFINITY)
      .filter((time) => Number.isFinite(time));
    return resetTimes.length > 0 ? Math.min(...resetTimes) : Number.POSITIVE_INFINITY;
  };

  // Sort providers by USAGE_SUPPORTED_PROVIDERS order, then alphabetically.
  // Optionally surface accounts with quotas expiring soonest first.
  const sortedConnections = [...providerFilteredConnections].sort((a, b) => {
    if (expiringFirst) {
      const expiryDiff = getEarliestResetTime(a) - getEarliestResetTime(b);
      if (expiryDiff !== 0) return expiryDiff;
    }
    const orderA = USAGE_SUPPORTED_PROVIDERS.indexOf(a.provider);
    const orderB = USAGE_SUPPORTED_PROVIDERS.indexOf(b.provider);
    if (orderA !== orderB) return orderA - orderB;
    return a.provider.localeCompare(b.provider);
  });

  const providerOptions = Array.from(new Set(filteredConnections.map((conn) => conn.provider))).sort();

  // Group connections by provider
  const groupedConnections = sortedConnections.reduce((groups, conn) => {
    const provider = conn.provider;
    if (!groups[provider]) {
      groups[provider] = [];
    }
    groups[provider].push(conn);
    return groups;
  }, {});

  // Sort providers by USAGE_SUPPORTED_PROVIDERS order
  const sortedProviders = Object.keys(groupedConnections).sort((a, b) => {
    const orderA = USAGE_SUPPORTED_PROVIDERS.indexOf(a);
    const orderB = USAGE_SUPPORTED_PROVIDERS.indexOf(b);
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  // Calculate summary stats
  const totalProviders = sortedConnections.length;
  const activeWithLimits = Object.values(quotaData).filter(
    (data) => data?.quotas?.length > 0,
  ).length;

  // Count low quotas (remaining < 30%)
  const lowQuotasCount = Object.values(quotaData).reduce((count, data) => {
    if (!data?.quotas) return count;

    const hasLowQuota = data.quotas.some((quota) => {
      const percentage = calculatePercentage(quota.used, quota.total);
      return percentage < 30 && quota.total > 0;
    });

    return count + (hasLowQuota ? 1 : 0);
  }, 0);

  // Empty state
  if (!connectionsLoading && sortedConnections.length === 0) {
    return (
      <Card padding="lg">
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[64px] text-text-muted opacity-20">
            cloud_off
          </span>
          <h3 className="mt-4 text-lg font-semibold text-text-primary">
            No Providers Connected
          </h3>
          <p className="mt-2 text-sm text-text-muted max-w-md mx-auto">
            Connect to providers with OAuth to track your API quota limits and
            usage.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-text-primary">
            Provider Limits
          </h2>
          <span className="text-sm text-text-muted">
            Last updated: {formatLastUpdated()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={providerFilter}
            onChange={(event) => setProviderFilter(event.target.value)}
            className="h-10 rounded-lg border border-black/10 bg-transparent px-3 text-sm text-text-primary dark:border-white/10"
            aria-label="Filter quota providers"
          >
            <option value="all">All providers</option>
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setExpiringFirst((prev) => !prev)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${expiringFirst ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-black/10 text-text-primary hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"}`}
            title="Sort accounts by earliest quota reset time"
          >
            <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
            Expiring first
          </button>
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                autoRefresh ? "text-primary" : "text-text-muted"
              }`}
            >
              {autoRefresh ? "toggle_on" : "toggle_off"}
            </span>
            <span className="text-sm text-text-primary">Auto-refresh</span>
            {autoRefresh && (
              <span className="text-xs text-text-muted">({countdown}s)</span>
            )}
          </button>

          {/* Refresh all button */}
          <Button
            variant="secondary"
            size="md"
            icon="refresh"
            onClick={refreshAll}
            disabled={refreshingAll}
            loading={refreshingAll}
          >
            Refresh All
          </Button>
        </div>
      </div>

      {/* Provider Group Cards - Full Width */}
      <div className="flex flex-col gap-6">
        {sortedProviders.map((provider) => {
          const accounts = groupedConnections[provider];
          const isLoadingAny = accounts.some((conn) => loading[conn.id]);
          
          return (
            <Card key={provider} padding="none">
              {/* Provider Header */}
              <div className="p-6 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                      <ProviderIcon
                        src={`/providers/${provider}.png`}
                        alt={provider}
                        size={40}
                        className="object-contain"
                        fallbackText={
                          provider?.slice(0, 2).toUpperCase() || "PR"
                        }
                      />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-text-primary capitalize">
                        {provider.replace(/-/g, " ")}
                      </h3>
                      <p className="text-sm text-text-muted">
                        {accounts.length} account{accounts.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => accounts.forEach((conn) => refreshProvider(conn.id, conn.provider))}
                    disabled={isLoadingAny}
                    className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                    title="Refresh all accounts"
                  >
                    <span
                      className={`material-symbols-outlined text-[20px] text-text-muted ${isLoadingAny ? "animate-spin" : ""}`}
                    >
                      refresh
                    </span>
                  </button>
                </div>
              </div>

              {/* Accounts - Horizontal Layout */}
              <div className="p-6">
                <div className="flex flex-row gap-4 overflow-x-auto pb-2">
                  {accounts.map((conn) => {
                    const quota = quotaData[conn.id];
                    const isLoading = loading[conn.id];
                    const error = errors[conn.id];

                    return (
                      <div
                        key={conn.id}
                        className={`flex-shrink-0 w-96 p-5 rounded-xl border transition-all duration-200 hover:shadow-md ${
                          isLoading ? "opacity-50" : ""
                        } ${error ? "border-red-300 bg-red-50/30" : "border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]"}`}
                      >
                        {/* Account Name Header */}
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-black/5 dark:border-white/5">
                          <h4 className="font-semibold text-sm text-text-primary truncate" title={conn.name}>
                            {conn.name || "Unnamed"}
                          </h4>
                          <button
                            onClick={() => refreshProvider(conn.id, conn.provider)}
                            disabled={isLoading}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-30"
                          >
                            <span className={`material-symbols-outlined text-[16px] text-text-muted ${isLoading ? "animate-spin" : ""}`}>
                              refresh
                            </span>
                          </button>
                        </div>
                        
                        {/* Models List - Vertical */}
                        {isLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <span className="material-symbols-outlined animate-spin text-[20px] text-text-muted">
                              progress_activity
                            </span>
                          </div>
                        ) : error ? (
                          <div className="text-xs text-red-500 text-center py-2">
                            ⚠️ {error.slice(0, 40)}...
                          </div>
                        ) : quota?.message ? (
                          <div className="text-xs text-text-muted text-center py-2">
                            {quota.message}
                          </div>
                        ) : quota?.quotas?.length > 0 ? (
                          <div className="space-y-2">
                            {quota.quotas.map((q, idx) => {
                              const pct = q.remainingPercentage || 0;
                              const colorClass = pct > 70 ? "bg-green-500" : pct > 30 ? "bg-yellow-500" : "bg-red-500";
                              const textClass = pct > 70 ? "text-green-500" : pct > 30 ? "text-yellow-500" : "text-red-500";
                              
                              return (
                                <div 
                                  key={idx} 
                                  className="py-2 px-3 rounded bg-white/50 dark:bg-black/20"
                                >
                                  {/* Model Name & Percentage */}
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-sm">
                                        {pct > 70 ? "🟢" : pct > 30 ? "🟡" : "🔴"}
                                      </span>
                                      <span className="text-xs text-text-primary truncate" title={q.name}>
                                        {q.name.length > 30 ? q.name.slice(0, 27) + "..." : q.name}
                                      </span>
                                    </div>
                                    <span className={`text-sm font-bold ${textClass}`}>
                                      {Math.round(pct)}%
                                    </span>
                                  </div>
                                  
                                  {/* Health Bar / Progress Bar */}
                                  <div className="h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full ${colorClass} transition-all duration-300`}
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                  
                                  {/* Reset Time */}
                                  {q.resetAt && (
                                    <p className="text-[10px] text-text-muted mt-1">
                                      Reset in {formatResetTime(q.resetAt)}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-text-muted text-center py-4">
                            No quota data
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
