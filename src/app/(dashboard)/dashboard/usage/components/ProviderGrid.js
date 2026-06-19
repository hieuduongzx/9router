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
  CheckCircle2,
  TrendingUp
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

// Provider Card Component
function ProviderCard({ provider, stats, isActive, isLast, hasError, activeCount = 0 }) {
  const config = getProviderConfig(provider.provider);
  const [imgError, setImgError] = useState(false);
  
  const totalTokens = (stats?.promptTokens || 0) + (stats?.completionTokens || 0);
  const cost = stats?.cost || 0;
  const requests = stats?.requests || 0;
  const lastUsed = stats?.lastUsed;

  return (
    <div className={cn(
      "group relative p-5 rounded-2xl border-2 transition-all duration-300",
      "hover:scale-[1.02]",
      isActive
        ? "bg-card border-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)] z-10"
        : hasError
          ? "bg-destructive/10 border-destructive"
          : "bg-card border-border hover:border-foreground/50"
    )}>
      {/* Status indicator */}
      <div className="absolute top-4 right-4">
        {isActive ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Live</span>
            </div>
            {activeCount > 0 && (
              <span className="text-[10px] font-bold text-foreground/50">
                {activeCount} active
              </span>
            )}
          </div>
        ) : hasError ? (
          <AlertCircle className="h-6 w-6 text-destructive" />
        ) : isLast ? (
          <Clock className="h-6 w-6 text-foreground/60" />
        ) : null}
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-accent">
          {!imgError ? (
            <img
              src={getProviderImageUrl(provider.provider)}
              alt={config.name}
              className="w-8 h-8 rounded object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-lg font-black text-foreground">
              {config.textIcon || provider.provider?.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-black tracking-wide truncate uppercase text-foreground">
            {config.name || provider.name || provider.provider}
          </h3>
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
            {provider.provider}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-accent/50">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-3.5 w-3.5 text-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">Requests</span>
          </div>
          <p className="text-xl font-black tracking-tight text-foreground">{formatNumber(requests)}</p>
        </div>

        <div className="p-3 rounded-xl bg-accent/50">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">Cost</span>
          </div>
          <p className="text-xl font-black tracking-tight text-foreground">{formatCurrency(cost)}</p>
        </div>

        <div className="p-3 rounded-xl bg-accent/50">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUp className="h-3.5 w-3.5 text-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">Input</span>
          </div>
          <p className="text-lg font-bold tracking-tight text-foreground">{formatNumber(stats?.promptTokens || 0)}</p>
        </div>

        <div className="p-3 rounded-xl bg-accent/50">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDown className="h-3.5 w-3.5 text-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">Output</span>
          </div>
          <p className="text-lg font-bold tracking-tight text-foreground">{formatNumber(stats?.completionTokens || 0)}</p>
        </div>
      </div>

      {/* Footer */}
      {lastUsed && (
        <div className={cn(
          "mt-4 pt-4 border-t flex items-center justify-between",
          hasError ? "border-destructive/20" : "border-border"
        )}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Last Used</span>
          <span className="text-xs font-bold text-foreground">{timeAgo(lastUsed)}</span>
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

// Summary Stats Component
function SummaryStats({ providers, totalRequests, totalCost, totalTokens }) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="p-5 rounded-2xl border-2 border-border bg-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-foreground text-background">
            <Zap className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
            Providers
          </span>
        </div>
        <p className="text-2xl font-black text-foreground">{providers.length}</p>
      </div>

      <div className="p-5 rounded-2xl border-2 border-border bg-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-foreground text-background">
            <Activity className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
            Total Requests
          </span>
        </div>
        <p className="text-2xl font-black text-foreground">{formatNumber(totalRequests)}</p>
      </div>

      <div className="p-5 rounded-2xl border-2 border-border bg-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-foreground text-background">
            <TrendingUp className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
            Total Cost
          </span>
        </div>
        <p className="text-2xl font-black text-foreground">{formatCurrency(totalCost)}</p>
      </div>

      <div className="p-5 rounded-2xl border-2 border-border bg-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-foreground text-background">
            <ArrowUp className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
            Total Tokens
          </span>
        </div>
        <p className="text-2xl font-black text-foreground">{formatNumber(totalTokens)}</p>
      </div>
    </div>
  );
}

// Main Provider Grid Component
export default function ProviderGrid({ 
  providers = [], 
  providerStats = {}, 
  activeRequests = [], 
  lastProvider = "", 
  errorProvider = "" 
}) {
  console.log("[DEBUG] ProviderGrid providers:", providers.map(p => p.provider));
  console.log("[DEBUG] ProviderGrid providerStats keys:", Object.keys(providerStats));
  console.log("[DEBUG] ProviderGrid providerStats sample:", JSON.stringify(providerStats).slice(0, 300));

  const activeSet = useMemo(
    () => new Set(activeRequests.map((r) => r.provider?.toLowerCase()).filter(Boolean)),
    [activeRequests]
  );
  const lastSet = useMemo(() => new Set(lastProvider ? [lastProvider.toLowerCase()] : []), [lastProvider]);
  const errorSet = useMemo(() => new Set(errorProvider ? [errorProvider.toLowerCase()] : []), [errorProvider]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalRequests = 0;
    let totalCost = 0;
    let totalTokens = 0;
    
    Object.values(providerStats).forEach((stats) => {
      totalRequests += stats?.requests || 0;
      totalCost += stats?.cost || 0;
      totalTokens += (stats?.promptTokens || 0) + (stats?.completionTokens || 0);
    });
    
    return { totalRequests, totalCost, totalTokens };
  }, [providerStats]);

  // Calculate active request count per provider
  const activeCountMap = useMemo(() => {
    const counts = {};
    activeRequests.forEach((r) => {
      const key = r.provider?.toLowerCase();
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [activeRequests]);

  // Sort: Active first, then by requests
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
    <div className="space-y-6">
      {/* Summary Stats */}
      <SummaryStats 
        providers={providers}
        {...totals}
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
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-2xl bg-accent mb-4">
            <Activity className="h-8 w-8 text-foreground/40" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">No Providers Active</h3>
          <p className="text-sm text-foreground/60 max-w-sm">
            Add providers to start tracking usage and costs.
          </p>
        </div>
      )}
    </div>
  );
}

ProviderGrid.propTypes = {
  providers: PropTypes.array,
  providerStats: PropTypes.object,
  activeRequests: PropTypes.array,
  lastProvider: PropTypes.string,
  errorProvider: PropTypes.string,
};
