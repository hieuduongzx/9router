"use client";

import { useCallback, useState } from "react";
import PropTypes from "prop-types";
import Drawer from "./Drawer";
import { cn } from "@/shared/utils/cn";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

const MONEY_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

function getCachedTokens(tokens) {
  return tokens?.cached_tokens || tokens?.cache_read_input_tokens || 0;
}

function getCacheCreationTokens(tokens) {
  return tokens?.cache_creation_input_tokens || 0;
}

function getInputTokens(tokens) {
  const prompt = tokens?.prompt_tokens || tokens?.input_tokens || 0;
  const cache = getCachedTokens(tokens);
  return prompt < cache ? cache : prompt;
}

function formatCost(value) {
  return Number.isFinite(value) ? MONEY_FORMAT.format(value) : "—";
}

function formatTiming(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value)) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(3)}s` : `${Math.round(value)}ms`;
}

const REPORT_FIELD_LIMIT = 4000;

function clampForReport(value) {
  if (value == null) return "—";
  if (typeof value === "object") {
    // Server-side truncation marker — say so instead of dumping the wrapper object.
    if (value._truncated) {
      return `[truncated by server · original ${value._originalSize} chars]\n${value._preview || ""}`;
    }
    const json = JSON.stringify(value, null, 2);
    return json.length > REPORT_FIELD_LIMIT ? `${json.slice(0, REPORT_FIELD_LIMIT)}…[+${json.length - REPORT_FIELD_LIMIT} chars]` : json;
  }
  const text = String(value);
  return text.length > REPORT_FIELD_LIMIT ? `${text.slice(0, REPORT_FIELD_LIMIT)}…[+${text.length - REPORT_FIELD_LIMIT} chars]` : text;
}

/**
 * Flatten one request into a paste-ready plain-text report for bug reports.
 * The API key is deliberately left out; everything else the drawer shows is kept.
 */
export function buildDetailReport(detail, providerName) {
  if (!detail) return "";
  const tokens = detail.tokens || {};
  const request = detail.request || {};
  const lines = [
    "=== 9router request detail ===",
    `id           : ${detail.id || "—"}`,
    `time         : ${detail.timestamp || "—"}`,
    `provider     : ${providerName || detail.provider || "—"}`,
    `model        : ${detail.model || "—"}`,
    `mode         : ${request.stream === true ? "stream" : request.stream === false ? "sync" : "—"}`,
    `status       : ${detail.status || "—"}`,
    `latency      : ttft ${formatTiming(detail.latency?.ttft)} / total ${formatTiming(detail.latency?.total)}`,
    `tokens       : in ${getInputTokens(tokens)} (cached ${getCachedTokens(tokens)}, cacheCreate ${getCacheCreationTokens(tokens)}) / out ${tokens.completion_tokens || tokens.output_tokens || 0}`,
    `cost         : total ${formatCost(detail.cost)} (in ${formatCost(detail.costInput)} / out ${formatCost(detail.costOutput)})`,
  ];

  if (detail.account?.username || detail.account?.apiKeyName) {
    lines.push(`account      : ${detail.account.username || "—"} · key ${detail.account.apiKeyName || "—"}`);
  }
  if (detail.connectionId) lines.push(`connectionId : ${detail.connectionId}`);
  if (detail.pxpipe) {
    lines.push(`pxpipe       : ${detail.pxpipe.applied ? `applied · saved ${detail.pxpipe.savedPct || 0}% · ${detail.pxpipe.imageCount || 0} images` : `skipped${detail.pxpipe.reason ? ` (${detail.pxpipe.reason})` : ""}`}`);
  }

  const requestSummary = {
    stream: request.stream,
    max_tokens: request.max_tokens ?? request.max_completion_tokens,
    messages: Array.isArray(request.messages) ? request.messages.length : request.messageCount,
    tools: Array.isArray(request.tools) ? request.tools.length : request.toolCount,
    tool_choice: request.tool_choice,
    response_format: request.response_format,
    thinking: request.thinking ?? request.reasoning ?? request.enable_thinking,
    temperature: request.temperature,
    top_p: request.top_p,
  };
  const definedSummary = Object.fromEntries(Object.entries(requestSummary).filter(([, value]) => value !== undefined));

  lines.push(
    "",
    `--- request params ---\n${JSON.stringify(definedSummary)}`,
    "",
    `--- provider request ---\n${clampForReport(detail.providerRequest)}`,
    "",
    `--- provider response ---\n${clampForReport(detail.providerResponse)}`,
    "",
    `--- response content ---\n${clampForReport(detail.response?.content)}`,
  );
  if (detail.response?.thinking) lines.push("", `--- response thinking ---\n${clampForReport(detail.response.thinking)}`);
  if (detail.response?.error) lines.push("", `--- error ---\n${clampForReport(detail.response.error)}`);

  return lines.join("\n");
}

function SummarySection({ icon, title, action, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="relative z-10 flex size-5 shrink-0 items-center justify-center bg-surface">
        <span className="material-symbols-outlined text-[16px] text-text-muted">{icon}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-text-muted">{title}</span>
          {action}
        </div>
        <div className="border border-border">{children}</div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong = false, mono = true }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className={cn(mono && "font-mono tabular-nums", strong ? "font-semibold text-text-main" : "text-text-main")}>
        {value}
      </span>
    </div>
  );
}

function NavButton({ icon, onClick, disabled, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-sm border border-border text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}

function CollapsibleSection({ title, children, defaultOpen = false, icon = null }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between bg-surface-2/40 p-3 transition-colors hover:bg-surface-2"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="material-symbols-outlined text-[18px] text-text-muted">{icon}</span>}
          <span className="font-mono text-sm font-semibold text-text-main">{title}</span>
        </div>
        <span className={cn(
          "material-symbols-outlined text-[20px] text-text-muted transition-transform duration-200",
          isOpen && "rotate-90",
        )}>
          chevron_right
        </span>
      </button>
      {isOpen && <div className="border-t border-border p-4">{children}</div>}
    </div>
  );
}

CollapsibleSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  defaultOpen: PropTypes.bool,
  icon: PropTypes.string,
};

export function useRequestDetailDrawer() {
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const [detailError, setDetailError] = useState("");

  const viewDetail = useCallback(async (log) => {
    if (!log?.detailId) return;
    setLoadingDetailId(log.detailId);
    setDetailError("");
    try {
      const response = await fetch(
        `/api/usage/request-details/${encodeURIComponent(log.detailId)}`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to load request detail");

      const detailTokens = body.tokens || {};
      const hasStoredTokens = (detailTokens.prompt_tokens || detailTokens.input_tokens || 0)
        + (detailTokens.completion_tokens || detailTokens.output_tokens || 0) > 0;
      setSelectedDetail({
        ...body,
        tokens: hasStoredTokens
          ? detailTokens
          : {
              prompt_tokens: log.inputTokens || 0,
              completion_tokens: log.outputTokens || 0,
            },
        account: {
          username: log.username,
          email: log.email,
          apiKeyName: log.apiKeyName,
        },
      });
      setIsDrawerOpen(true);
    } catch (error) {
      setDetailError(error.message);
    } finally {
      setLoadingDetailId(null);
    }
  }, []);

  const closeDetail = useCallback(() => setIsDrawerOpen(false), []);

  return {
    closeDetail,
    detailError,
    isDrawerOpen,
    loadingDetailId,
    selectedDetail,
    viewDetail,
  };
}

export default function RequestDetailDrawer({
  detail,
  isOpen,
  onClose,
  providerName,
  showProviderDetails = true,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}) {
  const resolvedProviderName = providerName || detail?.provider || "Unknown";
  const { copied, copy } = useCopyToClipboard(1500);
  const completed = detail?.status === "success" || detail?.status === "ok";

  const headerActions = (
    <>
      {detail && (
        <NavButton
          icon={copied === "report" ? "check" : "content_copy"}
          onClick={() => copy(buildDetailReport(detail, resolvedProviderName), "report")}
          label="Copy debug report"
        />
      )}
      {(onPrev || onNext) && (
        <>
          <NavButton icon="expand_less" onClick={onPrev} disabled={!hasPrev} label="Previous request" />
          <NavButton icon="expand_more" onClick={onNext} disabled={!hasNext} label="Next request" />
        </>
      )}
    </>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Usage Details"
      headerActions={headerActions}
      width="lg"
      accentClassName={detail ? (completed ? "bg-emerald-500" : "bg-red-500") : undefined}
    >
      {detail && (
        <div className="space-y-6">
        <div className="relative space-y-6">
          <span className="pointer-events-none absolute bottom-2 left-[9px] top-2 w-px bg-border" aria-hidden />
          <SummarySection
            icon="layers"
            title="Request"
            action={<span className="font-mono text-[11px] text-text-subtle">{new Date(detail.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).toUpperCase()}</span>}
          >
            <SummaryRow label="Mode" value={detail.request?.stream === true ? "stream" : detail.request?.stream === false ? "sync" : "—"} />
            {showProviderDetails && <SummaryRow label="Provider" value={resolvedProviderName} mono={false} />}
            <SummaryRow label="Model" value={detail.model || "—"} />
            {detail.account?.username && <SummaryRow label="Account" value={detail.account.username} mono={false} />}
          </SummarySection>

          <SummarySection icon="tag" title="Tokens">
            <SummaryRow label="Input" value={NUMBER_FORMAT.format(getInputTokens(detail.tokens))} />
            <SummaryRow label="Output" value={NUMBER_FORMAT.format(detail.tokens?.completion_tokens || 0)} />
            <SummaryRow
              label="Total"
              strong
              value={NUMBER_FORMAT.format(getInputTokens(detail.tokens) + (detail.tokens?.completion_tokens || 0))}
            />
            {getCachedTokens(detail.tokens) > 0 && <SummaryRow label="Cached" value={NUMBER_FORMAT.format(getCachedTokens(detail.tokens))} />}
            {getCacheCreationTokens(detail.tokens) > 0 && <SummaryRow label="Cache creation" value={NUMBER_FORMAT.format(getCacheCreationTokens(detail.tokens))} />}
          </SummarySection>

          <SummarySection icon="payments" title="Cost">
            {Number.isFinite(detail.costInput) && <SummaryRow label="Input" value={formatCost(detail.costInput)} />}
            {Number.isFinite(detail.costOutput) && <SummaryRow label="Output" value={formatCost(detail.costOutput)} />}
            <SummaryRow label="Total" strong value={formatCost(detail.cost)} />
            {Number.isFinite(detail.cost) && <SummaryRow label="Credits Used" value={formatCost(detail.cost)} />}
          </SummarySection>

          <SummarySection icon="troubleshoot" title="Diagnostics">
            <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-text-muted">Trace ID</span>
              <div className="flex items-center gap-1.5">
                <span className="rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text-main">
                  {String(detail.id || "").slice(0, 8)}…
                </span>
                <button
                  type="button"
                  onClick={() => copy(detail.id || "", "trace")}
                  className="flex size-6 items-center justify-center rounded-sm border border-border text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
                  aria-label="Copy trace ID"
                >
                  <span className="material-symbols-outlined text-[13px]">{copied === "trace" ? "check" : "content_copy"}</span>
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-sm">
              <span className="text-text-muted">Debug report</span>
              <button
                type="button"
                onClick={() => copy(buildDetailReport(detail, resolvedProviderName), "report")}
                className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border px-2 font-mono text-[11px] text-text-main transition-colors hover:bg-surface-2"
              >
                <span className="material-symbols-outlined text-[13px]">{copied === "report" ? "check" : "content_copy"}</span>
                {copied === "report" ? "Copied" : "Copy all"}
              </button>
            </div>
          </SummarySection>

          <div className="flex items-start gap-3">
            <span className="relative z-10 flex size-5 shrink-0 items-center justify-center bg-surface">
              <span className={cn("size-2 ", completed ? "bg-emerald-500" : "bg-red-500")} />
            </span>
            <p className={cn("font-mono text-xs", completed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {completed
                ? `Response completed in ${formatTiming(detail.latency?.total)}`
                : `Response failed after ${formatTiming(detail.latency?.total)}`}
            </p>
          </div>
        </div>

          {detail.pxpipe && (
            <div className="border border-border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-text-muted">image</span>
                <span className="font-mono text-sm font-semibold text-text-main">PXPIPE</span>
                <span className={cn(
                  "rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase",
                  detail.pxpipe.applied
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                )}>
                  {detail.pxpipe.applied ? "Activated" : "Skipped"}
                </span>
              </div>
              {detail.pxpipe.applied ? (
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <span className="block text-xs text-text-muted">Original (est.)</span>
                    <span className="font-mono">{(detail.pxpipe.tokensBeforeEst || 0).toLocaleString()} tokens</span>
                  </div>
                  <div>
                    <span className="block text-xs text-text-muted">Compressed (est.)</span>
                    <span className="font-mono">{(detail.pxpipe.tokensAfterEst || 0).toLocaleString()} tokens</span>
                  </div>
                  <div>
                    <span className="block text-xs text-text-muted">Saved</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">{detail.pxpipe.savedPct || 0}%</span>
                  </div>
                  <div>
                    <span className="block text-xs text-text-muted">Images</span>
                    <span className="font-mono">{detail.pxpipe.imageCount || 0} ({detail.pxpipe.durationMs || 0}ms)</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  Reason: <span className="font-mono">{detail.pxpipe.reason}</span>
                  {detail.pxpipe.detail ? ` — ${detail.pxpipe.detail}` : ""}
                </p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-text-muted">code</span>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-text-muted">Raw Payloads</span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
            <CollapsibleSection title="Client Request (Input)" icon="input">
              <pre className="terminal-block max-h-[300px] max-w-full overflow-auto rounded-sm p-3 sm:p-4">
                {JSON.stringify(detail.request, null, 2)}
              </pre>
            </CollapsibleSection>

            {showProviderDetails && detail.providerRequest && (
              <CollapsibleSection title="Provider Request (Translated)" icon="translate">
                <pre className="terminal-block max-h-[300px] max-w-full overflow-auto rounded-sm p-3 sm:p-4">
                  {JSON.stringify(detail.providerRequest, null, 2)}
                </pre>
              </CollapsibleSection>
            )}

            {showProviderDetails && detail.providerResponse && (
              <CollapsibleSection title="Provider Response (Raw)" icon="data_object">
                <pre className="terminal-block max-h-[300px] max-w-full overflow-auto rounded-sm p-3 sm:p-4">
                  {typeof detail.providerResponse === "object"
                    ? JSON.stringify(detail.providerResponse, null, 2)
                    : detail.providerResponse}
                </pre>
              </CollapsibleSection>
            )}

            <CollapsibleSection title="Client Response (Final)" icon="output">
              {detail.response?.thinking && (
                <div className="mb-4">
                  <h4 className="mb-2 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wide text-text-muted">
                    <span className="material-symbols-outlined text-[16px]">psychology</span>
                    Thinking Process
                  </h4>
                  <pre className="terminal-block max-h-[200px] max-w-full overflow-auto rounded-sm p-3 sm:p-4">
                    {detail.response.thinking}
                  </pre>
                </div>
              )}
              <h4 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-text-muted">Content</h4>
              <pre className="terminal-block max-h-[300px] max-w-full overflow-auto rounded-sm p-3 sm:p-4">
                {detail.response?.content || "[No content]"}
              </pre>
            </CollapsibleSection>
          </div>
        </div>
      )}
    </Drawer>
  );
}

RequestDetailDrawer.propTypes = {
  detail: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  providerName: PropTypes.string,
  showProviderDetails: PropTypes.bool,
  onPrev: PropTypes.func,
  onNext: PropTypes.func,
  hasPrev: PropTypes.bool,
  hasNext: PropTypes.bool,
};
