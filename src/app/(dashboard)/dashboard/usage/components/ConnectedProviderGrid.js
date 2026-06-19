"use client";

import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { cn } from "@/lib/utils";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import {
  Activity,
  ArrowUp,
  ArrowDown,
  Clock,
  Zap,
  AlertCircle,
  TrendingUp,
  Command
} from "lucide-react";

function getProviderConfig(providerId) {
  return AI_PROVIDERS[providerId] || { name: providerId, textIcon: "??" };
}

function getProviderImageUrl(providerId) {
  return `/providers/${providerId}.png`;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

function formatCurrency(cost) {
  if (cost >= 1) return "$" + cost.toFixed(2);
  if (cost >= 0.01) return "$" + cost.toFixed(3);
  return "$" + cost.toFixed(4);
}

function timeAgo(timestamp) {
  if (!timestamp) return "Never";
  const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Inline stat pill for HubHeader
function StatPill({ icon, label, value, highlight = false }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs",
      highlight
        ? "bg-foreground/10 border border-foreground/20 text-foreground"
        : "bg-accent text-muted-foreground"
    )}>
      <span className={cn("shrink-0", highlight ? "text-foreground" : "text-muted-foreground/70")}>
        {icon}
      </span>
      <span className={cn("font-bold tabular-nums", highlight ? "text-foreground" : "text-foreground/80")}>
        {value}
      </span>
      <span className="text-muted-foreground/60 hidden sm:inline font-medium">{label}</span>
    </div>
  );
}

StatPill.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  highlight: PropTypes.bool,
};

// Compact hub header — replaces RouterHub + SummaryStats
function HubHeader({ providers, totalCost, totalTokens, activeCount }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card">
      {/* Identity */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center shrink-0">
          <Command className="h-3.5 w-3.5 text-background" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-xs font-black tracking-widest uppercase text-foreground">
            Api2K
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
            {activeCount > 0 ? `${activeCount} active` : "routing hub"}
          </span>
        </div>
        {activeCount > 0 && (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-foreground" />
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border shrink-0" />

      {/* Stats pills */}
      <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-end">
        <StatPill
          icon={<Zap className="h-3 w-3" />}
          label="providers"
          value={providers.length}
        />
        <StatPill
          icon={<Activity className="h-3 w-3" />}
          label="active"
          value={activeCount}
          highlight={activeCount > 0}
        />
        <StatPill
          icon={<TrendingUp className="h-3 w-3" />}
          label="cost"
          value={formatCurrency(totalCost)}
        />
        <StatPill
          icon={<ArrowUp className="h-3 w-3" />}
          label="tokens"
          value={formatNumber(totalTokens)}
        />
      </div>
    </div>
  );
}

HubHeader.propTypes = {
  providers: PropTypes.array.isRequired,
  totalCost: PropTypes.number.isRequired,
  totalTokens: PropTypes.number.isRequired,
  activeCount: PropTypes.number.isRequired,
};

// Status badge extracted from ProviderCard
function StatusBadge({ isActive, hasError, isLast, activeCount }) {
  if (isActive) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 shrink-0">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
          {activeCount > 1 ? `${activeCount}×` : "Live"}
        </span>
      </div>
    );
  }
  if (hasError) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/10 border border-destructive/25 shrink-0">
        <AlertCircle className="h-3 w-3 text-destructive" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-destructive">Error</span>
      </div>
    );
  }
  if (isLast) {
    return <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
  return null;
}

StatusBadge.propTypes = {
  isActive: PropTypes.bool,
  hasError: PropTypes.bool,
  isLast: PropTypes.bool,
  activeCount: PropTypes.number,
};

// Stat cell for the 2×2 grid inside each card
function StatCell({ icon, label, value, large = false }) {
  return (
    <div className="p-2.5 rounded-lg bg-accent/50">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="shrink-0">{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className={cn(
        "font-black tracking-tight text-foreground tabular-nums",
        large ? "text-lg" : "text-base"
      )}>
        {value}
      </p>
    </div>
  );
}

StatCell.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  large: PropTypes.bool,
};

// Provider Card Component
function ProviderCard({
  provider,
  stats,
  isActive,
  isLast,
  hasError,
  activeCount
}) {
  const config = getProviderConfig(provider.provider);
  const [imgError, setImgError] = useState(false);

  const cost = stats?.cost || 0;
  const requests = stats?.requests || 0;
  const lastUsed = stats?.lastUsed;

  return (
    <div className={cn(
      "relative rounded-xl border transition-all duration-200 overflow-hidden bg-card p-4",
      isActive
        ? "border-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.3)] animate-pulse-border"
        : hasError
          ? "border-destructive/40 bg-destructive/5"
          : "border-border hover:border-foreground/25 hover:shadow-sm"
    )}>
      {/* Animated green border glow for active state */}
      {isActive && (
        <>
          <div className="absolute inset-0 rounded-xl border-2 border-emerald-500/50 animate-ping-slow pointer-events-none" />
          <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-emerald-500/20 via-transparent to-emerald-500/20 opacity-50 animate-pulse-slow pointer-events-none" />
        </>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4 pl-1">
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            isActive
              ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
              : "bg-accent"
          )}>
            {!imgError ? (
              <img
                src={getProviderImageUrl(provider.provider)}
                alt={config.name}
                className="w-7 h-7 rounded object-contain"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="text-sm font-black text-foreground">
                {config.textIcon || provider.provider?.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          {/* Name */}
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase tracking-wide text-foreground truncate leading-tight">
              {config.name || provider.name || provider.provider}
            </h3>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight mt-0.5">
              {provider.provider}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <StatusBadge
          isActive={isActive}
          hasError={hasError}
          isLast={isLast}
          activeCount={activeCount}
        />
      </div>

      {/* Stats 2×2 */}
      <div className="grid grid-cols-2 gap-2">
        <StatCell
          icon={<Activity className="h-3 w-3" />}
          label="Requests"
          value={formatNumber(requests)}
          large
        />
        <StatCell
          icon={<TrendingUp className="h-3 w-3" />}
          label="Cost"
          value={formatCurrency(cost)}
          large
        />
        <StatCell
          icon={<div className="text-sky-500"><ArrowUp className="h-3 w-3" /></div>}
          label="Input"
          value={formatNumber(stats?.promptTokens || 0)}
        />
        <StatCell
          icon={<div className="text-amber-500"><ArrowDown className="h-3 w-3" /></div>}
          label="Output"
          value={formatNumber(stats?.completionTokens || 0)}
        />
      </div>

      {/* Footer */}
      {(lastUsed || cost > 0) && (
        <div className={cn(
          "mt-3 pt-3 border-t flex items-center justify-between",
          hasError ? "border-destructive/20" : "border-border"
        )}>
          {lastUsed ? (
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Last Used
              </span>
              <span className="text-xs font-bold text-foreground">
                {timeAgo(lastUsed)}
              </span>
            </div>
          ) : (
            <div />
          )}
          
          {cost > 0 && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cost
              </span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(cost)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

ProviderCard.propTypes = {
  provider: PropTypes.object.isRequired,
  stats: PropTypes.object,
  isActive: PropTypes.bool,
  isLast: PropTypes.bool,
  hasError: PropTypes.bool,
  activeCount: PropTypes.number,
};

// Main Connected Grid Component
export default function ConnectedProviderGrid({
  providers = [],
  providerStats = {},
  activeRequests = [],
  lastProvider = "",
  errorProvider = ""
}) {
  const activeSet = useMemo(
    () => new Set(activeRequests.map((r) => r.provider?.toLowerCase()).filter(Boolean)),
    [activeRequests]
  );
  const lastSet = useMemo(() => new Set(lastProvider ? [lastProvider.toLowerCase()] : []), [lastProvider]);
  const errorSet = useMemo(() => new Set(errorProvider ? [errorProvider.toLowerCase()] : []), [errorProvider]);

  const activeCountMap = useMemo(() => {
    const counts = {};
    activeRequests.forEach((r) => {
      const key = r.provider?.toLowerCase();
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [activeRequests]);

  const totals = useMemo(() => {
    let totalRequests = 0, totalCost = 0, totalTokens = 0;
    Object.values(providerStats).forEach((stats) => {
      totalRequests += stats?.requests || 0;
      totalCost += stats?.cost || 0;
      totalTokens += (stats?.promptTokens || 0) + (stats?.completionTokens || 0);
    });
    return { totalRequests, totalCost, totalTokens, activeCount: activeRequests.length };
  }, [providerStats, activeRequests]);

  const sortedProviders = useMemo(() => {
    return [...providers].sort((a, b) => {
      const aActive = activeSet.has(a.provider?.toLowerCase());
      const bActive = activeSet.has(b.provider?.toLowerCase());
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      const aRequests = providerStats[a.provider]?.requests || 0;
      const bRequests = providerStats[b.provider]?.requests || 0;
      return bRequests - aRequests;
    });
  }, [providers, activeSet, providerStats]);

  return (
    <div className="space-y-4">
      {/* Hub Header */}
      <HubHeader
        providers={providers}
        totalCost={totals.totalCost}
        totalTokens={totals.totalTokens}
        activeCount={totals.activeCount}
      />

      {/* Provider Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {sortedProviders.map((provider) => {
          const providerKey = provider.provider;
          const providerKeyLower = providerKey?.toLowerCase();
          const isActive = activeSet.has(providerKeyLower);
          const isLast = lastSet.has(providerKeyLower);
          const hasError = errorSet.has(providerKeyLower);
          const stats = providerStats[providerKey];
          const activeCount = activeCountMap[providerKeyLower] || 0;

          return (
            <ProviderCard
              key={providerKey}
              provider={provider}
              stats={stats}
              isActive={isActive}
              isLast={isLast}
              hasError={hasError}
              activeCount={activeCount}
            />
          );
        })}
      </div>

      {providers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center mb-3">
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1">No Providers Connected</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Add providers to start routing requests through Api2K.
          </p>
        </div>
      )}
    </div>
  );
}

ConnectedProviderGrid.propTypes = {
  providers: PropTypes.array,
  providerStats: PropTypes.object,
  activeRequests: PropTypes.array,
  lastProvider: PropTypes.string,
  errorProvider: PropTypes.string,
};
