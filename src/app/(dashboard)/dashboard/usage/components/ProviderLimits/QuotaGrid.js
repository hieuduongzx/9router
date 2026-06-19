"use client";

import { cn } from "@/shared/utils/cn";
import { formatResetTime } from "./utils";

// Calculate color based on remaining percentage
const getColorClasses = (remainingPercentage) => {
  if (remainingPercentage > 70) {
    return {
      text: "text-green-500",
      bg: "bg-green-500",
      bgLight: "bg-green-500/10",
      border: "border-green-500/20",
      emoji: "🟢"
    };
  }
  
  if (remainingPercentage >= 30) {
    return {
      text: "text-yellow-500",
      bg: "bg-yellow-500",
      bgLight: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      emoji: "🟡"
    };
  }
  
  return {
    text: "text-red-500",
    bg: "bg-red-500",
    bgLight: "bg-red-500/10",
    border: "border-red-500/20",
    emoji: "🔴"
  };
};

// Format reset time display
const formatResetTimeDisplay = (resetTime) => {
  if (!resetTime) return null;
  
  try {
    const resetDate = new Date(resetTime);
    const now = new Date();
    const isToday = resetDate.toDateString() === now.toDateString();
    const isTomorrow = resetDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();
    
    const timeStr = resetDate.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    
    if (isToday) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;
    
    return resetDate.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return null;
  }
};

// Individual quota square card
function QuotaSquare({ quota }) {
  const percentage = quota.remainingPercentage !== undefined 
    ? Math.round(quota.remainingPercentage)
    : quota.total > 0 
      ? Math.round(((quota.total - quota.used) / quota.total) * 100)
      : 0;
      
  const colors = getColorClasses(percentage);
  const countdown = formatResetTime(quota.resetAt);
  const resetDisplay = formatResetTimeDisplay(quota.resetAt);
  const hasRealNumbers = quota.used !== null && quota.total !== null;

  return (
    <div className={cn(
      "relative aspect-square rounded-xl p-4 flex flex-col justify-between",
      "border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
      colors.bgLight,
      colors.border
    )}>
      {/* Top: Model name */}
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-sm text-text-primary leading-tight line-clamp-2">
          {quota.name}
        </h4>
        <span className="text-sm">{colors.emoji}</span>
      </div>

      {/* Middle: Big percentage */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className={cn("text-4xl font-bold", colors.text)}>
            {percentage}%
          </span>
          <p className="text-xs text-text-muted mt-1">remaining</p>
        </div>
      </div>

      {/* Bottom: Details */}
      <div className="space-y-1">
        {hasRealNumbers ? (
          <p className="text-xs text-text-muted text-center">
            {quota.used?.toLocaleString()} / {quota.total?.toLocaleString()}
          </p>
        ) : (
          <p className="text-xs text-text-muted text-center italic">
            Percentage only
          </p>
        )}
        
        {countdown !== "-" && (
          <p className="text-xs text-text-muted text-center">
            Reset in {countdown}
          </p>
        )}
        
        {resetDisplay && (
          <p className="text-[10px] text-text-muted/70 text-center">
            {resetDisplay}
          </p>
        )}
      </div>

      {/* Progress bar at bottom */}
      <div className={cn("absolute bottom-0 left-0 right-0 h-1 rounded-b-xl", colors.bgLight)}>
        <div 
          className={cn("h-full rounded-bl-xl transition-all duration-300", colors.bg)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

// Grid container for quotas
export default function QuotaGrid({ quotas, provider }) {
  if (!quotas || quotas.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted">
        <span className="material-symbols-outlined text-[48px] opacity-20">
          data_usage
        </span>
        <p className="text-sm mt-2">No quota data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Grid of quota squares - 4 columns on large screens */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {quotas.map((quota, index) => (
          <QuotaSquare key={`${quota.name}-${index}`} quota={quota} />
        ))}
      </div>
    </div>
  );
}
