"use client";

import { useCallback, useState } from "react";
import PropTypes from "prop-types";
import Drawer from "./Drawer";
import { cn } from "@/shared/utils/cn";

const MONEY_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

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

function CollapsibleSection({ title, children, defaultOpen = false, icon = null }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-black/5 dark:border-white/5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between bg-black/[0.02] p-3 transition-colors hover:bg-black/[0.04] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="material-symbols-outlined text-[18px] text-text-muted">{icon}</span>}
          <span className="text-sm font-semibold text-text-main">{title}</span>
        </div>
        <span className={cn(
          "material-symbols-outlined text-[20px] text-text-muted transition-transform duration-200",
          isOpen && "rotate-90",
        )}>
          chevron_right
        </span>
      </button>
      {isOpen && <div className="border-t border-black/5 p-4 dark:border-white/5">{children}</div>}
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

export default function RequestDetailDrawer({ detail, isOpen, onClose, providerName }) {
  const resolvedProviderName = providerName || detail?.provider || "Unknown";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Request Details" width="lg">
      {detail && (
        <div className="space-y-6">
          <div className="grid min-w-0 grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-text-muted">ID:</span>{" "}
              <span className="break-all font-mono text-text-main">{detail.id}</span>
            </div>
            <div>
              <span className="text-text-muted">Timestamp:</span>{" "}
              <span className="text-text-main">{new Date(detail.timestamp).toLocaleString()}</span>
            </div>
            {detail.account && (
              <>
                <div>
                  <span className="text-text-muted">Account:</span>{" "}
                  <span className="font-medium text-text-main">{detail.account.username}</span>
                  {detail.account.email && (
                    <span className="ml-1 text-xs text-text-muted">({detail.account.email})</span>
                  )}
                </div>
                <div>
                  <span className="text-text-muted">API Key:</span>{" "}
                  <span className="font-medium text-text-main">{detail.account.apiKeyName}</span>
                </div>
              </>
            )}
            <div>
              <span className="text-text-muted">Provider:</span>{" "}
              <span className="font-medium text-text-main">{resolvedProviderName}</span>
            </div>
            <div>
              <span className="text-text-muted">Model:</span>{" "}
              <span className="font-mono text-text-main">{detail.model}</span>
            </div>
            <div>
              <span className="text-text-muted">Status:</span>{" "}
              <span className={cn(
                "font-medium",
                detail.status === "success" ? "text-green-600" : "text-red-600",
              )}>
                {detail.status}
              </span>
            </div>
            <div>
              <span className="text-text-muted">Latency:</span>{" "}
              <span className="font-mono text-text-main">
                TTFT {detail.latency?.ttft || 0}ms / Total {detail.latency?.total || 0}ms
              </span>
            </div>
            <div>
              <span className="text-text-muted">Input Tokens:</span>{" "}
              <span className="font-mono text-text-main">{getInputTokens(detail.tokens).toLocaleString()}</span>
            </div>
            {getCachedTokens(detail.tokens) > 0 && (
              <div>
                <span className="text-text-muted">Cached Tokens:</span>{" "}
                <span className="font-mono text-text-main">{getCachedTokens(detail.tokens).toLocaleString()}</span>
              </div>
            )}
            {getCacheCreationTokens(detail.tokens) > 0 && (
              <div>
                <span className="text-text-muted">Cache Creation:</span>{" "}
                <span className="font-mono text-text-main">{getCacheCreationTokens(detail.tokens).toLocaleString()}</span>
              </div>
            )}
            <div>
              <span className="text-text-muted">Output Tokens:</span>{" "}
              <span className="font-mono text-text-main">{detail.tokens?.completion_tokens?.toLocaleString() || 0}</span>
            </div>
            {Number.isFinite(detail.cost) && (
              <div>
                <span className="text-text-muted">Price:</span>{" "}
                <span className="font-mono font-medium text-warning">
                  {MONEY_FORMAT.format(detail.cost)}
                </span>
              </div>
            )}
          </div>

          {detail.pxpipe && (
            <div className="rounded-lg border border-black/5 p-4 dark:border-white/5">
              <div className="mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-text-muted">image</span>
                <span className="text-sm font-semibold text-text-main">PXPIPE</span>
                <span className={cn(
                  "rounded px-2 py-0.5 text-xs",
                  detail.pxpipe.applied
                    ? "bg-green-500/15 text-green-600"
                    : "bg-amber-500/15 text-amber-600",
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
                    <span className="font-mono text-green-600">{detail.pxpipe.savedPct || 0}%</span>
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
            <CollapsibleSection title="1. Client Request (Input)" defaultOpen icon="input">
              <pre className="max-h-[300px] max-w-full overflow-auto rounded-lg border border-black/5 bg-black/5 p-3 font-mono text-xs text-text-main dark:border-white/5 dark:bg-white/5 sm:p-4">
                {JSON.stringify(detail.request, null, 2)}
              </pre>
            </CollapsibleSection>

            {detail.providerRequest && (
              <CollapsibleSection title="2. Provider Request (Translated)" icon="translate">
                <pre className="max-h-[300px] max-w-full overflow-auto rounded-lg border border-black/5 bg-black/5 p-3 font-mono text-xs text-text-main dark:border-white/5 dark:bg-white/5 sm:p-4">
                  {JSON.stringify(detail.providerRequest, null, 2)}
                </pre>
              </CollapsibleSection>
            )}

            {detail.providerResponse && (
              <CollapsibleSection title="3. Provider Response (Raw)" icon="data_object">
                <pre className="max-h-[300px] max-w-full overflow-auto rounded-lg border border-black/5 bg-black/5 p-3 font-mono text-xs text-text-main dark:border-white/5 dark:bg-white/5 sm:p-4">
                  {typeof detail.providerResponse === "object"
                    ? JSON.stringify(detail.providerResponse, null, 2)
                    : detail.providerResponse}
                </pre>
              </CollapsibleSection>
            )}

            <CollapsibleSection title="4. Client Response (Final)" defaultOpen icon="output">
              {detail.response?.thinking && (
                <div className="mb-4">
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-main opacity-70">
                    <span className="material-symbols-outlined text-[16px]">psychology</span>
                    Thinking Process
                  </h4>
                  <pre className="max-h-[200px] max-w-full overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3 font-mono text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:p-4">
                    {detail.response.thinking}
                  </pre>
                </div>
              )}
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-main opacity-70">Content</h4>
              <pre className="max-h-[300px] max-w-full overflow-auto rounded-lg border border-black/5 bg-black/5 p-3 font-mono text-xs text-text-main dark:border-white/5 dark:bg-white/5 sm:p-4">
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
};
