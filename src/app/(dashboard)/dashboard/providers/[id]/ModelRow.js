import PropTypes from "prop-types";
import { CapacityBadges } from "@/shared/components";

const WEB_SEARCH_TEST_META = {
  verified: {
    title: "Native web search verified — test again",
    icon: "task_alt",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  unsupported: {
    title: "Native web search rejected — test again",
    icon: "search_off",
    color: "text-red-600 dark:text-red-400",
  },
  unknown: {
    title: "No structured search evidence — test again",
    icon: "help",
    color: "text-amber-600 dark:text-amber-400",
  },
  error: {
    title: "Web search verification failed — test again",
    icon: "warning",
    color: "text-red-600 dark:text-red-400",
  },
};

const DEFAULT_WEB_SEARCH_TEST_META = {
  title: "Verify native web search (may incur search charges)",
  icon: "travel_explore",
  color: "text-text-muted",
};

export default function ModelRow({
  model,
  fullModel,
  alias,
  copied,
  onCopy,
  testStatus,
  webSearchTestStatus,
  isCustom,
  isFree,
  onDeleteAlias,
  onTest,
  onTestWebSearch,
  isTesting,
  isTestingWebSearch,
  onDisable,
  caps,
  thinkingSuffix,
}) {
  const displayModel = thinkingSuffix ? `${fullModel}(${thinkingSuffix})` : fullModel;
  const iconColor = testStatus === "ok"
    ? "#22c55e"
    : testStatus === "error"
    ? "#ef4444"
    : undefined;
  const copyKey = `model-${model.id}`;
  const hasSecondaryName = model.name && model.name !== model.id;
  // The catalog's `search` flag is documentation-based, not runtime proof.
  // This page renders search state only from the dedicated evidence probe below.
  const runtimeSafeCaps = caps ? { ...caps, search: false } : caps;
  const isAnyTestRunning = isTesting || isTestingWebSearch;
  const webSearchMeta = WEB_SEARCH_TEST_META[webSearchTestStatus] || DEFAULT_WEB_SEARCH_TEST_META;
  const webSearchTestTitle = isTestingWebSearch ? "Verifying native web search" : webSearchMeta.title;
  const webSearchTestIcon = isTestingWebSearch ? "progress_activity" : webSearchMeta.icon;
  const webSearchTestColor = webSearchMeta.color;

  return (
    <div
      role="listitem"
      className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-1.5 transition-colors hover:bg-sidebar/50 focus-within:bg-sidebar/50"
    >
      <span
        className="material-symbols-outlined text-lg text-text-muted"
        style={iconColor ? { color: iconColor } : undefined}
        title={testStatus === "ok" ? "Model test passed" : testStatus === "error" ? "Model test failed" : "Model"}
      >
        {testStatus === "ok" ? "check_circle" : testStatus === "error" ? "cancel" : "smart_toy"}
      </span>

      <div className="min-w-0 py-1">
        <code className="block truncate font-mono text-sm font-medium text-text-main" title={displayModel}>
          {displayModel}
        </code>
        {(hasSecondaryName || caps) && (
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
            {hasSecondaryName && (
              <span className="truncate text-xs text-text-muted">{model.name}</span>
            )}
            <CapacityBadges caps={runtimeSafeCaps} colorOverride="text-text-muted/70" size={12} />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {onTest && (
          <button
            type="button"
            onClick={onTest}
            disabled={isAnyTestRunning}
            className="inline-flex size-11 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-sidebar hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-wait disabled:opacity-60"
            title={isTesting ? "Testing model" : isTestingWebSearch ? "Web search verification in progress" : "Test model"}
            aria-label={isTesting ? `Testing ${displayModel}` : `Test ${displayModel}`}
          >
            <span className={`material-symbols-outlined text-base ${isTesting ? "animate-spin motion-reduce:animate-none" : ""}`}>
              {isTesting ? "progress_activity" : "science"}
            </span>
          </button>
        )}

        {onTestWebSearch && (
          <button
            type="button"
            onClick={onTestWebSearch}
            disabled={isAnyTestRunning}
            className={`inline-flex size-11 items-center justify-center rounded-sm transition-colors hover:bg-sidebar hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-wait disabled:opacity-60 ${webSearchTestColor}`}
            title={webSearchTestTitle}
            aria-label={`${webSearchTestTitle} with ${displayModel}`}
          >
            <span className={`material-symbols-outlined text-base ${isTestingWebSearch ? "animate-spin motion-reduce:animate-none" : ""}`}>
              {webSearchTestIcon}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onCopy(displayModel, copyKey)}
          className="inline-flex size-11 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-sidebar hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          title={copied === copyKey ? "Copied" : "Copy model ID"}
          aria-label={copied === copyKey ? `Copied ${displayModel}` : `Copy ${displayModel}`}
        >
          <span className="material-symbols-outlined text-base">
            {copied === copyKey ? "check" : "content_copy"}
          </span>
        </button>

        {isCustom ? (
          <button
            type="button"
            onClick={onDeleteAlias}
            className="inline-flex size-11 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
            title="Remove custom model"
            aria-label={`Remove ${displayModel}`}
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        ) : onDisable ? (
          <button
            type="button"
            onClick={onDisable}
            className="inline-flex size-11 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
            title="Disable model"
            aria-label={`Disable ${displayModel}`}
          >
            <span className="material-symbols-outlined text-base">block</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

ModelRow.propTypes = {
  model: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }).isRequired,
  fullModel: PropTypes.string.isRequired,
  alias: PropTypes.string,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  testStatus: PropTypes.oneOf(["ok", "error"]),
  webSearchTestStatus: PropTypes.oneOf(["verified", "unsupported", "unknown", "error"]),
  isCustom: PropTypes.bool,
  isFree: PropTypes.bool,
  onDeleteAlias: PropTypes.func,
  onTest: PropTypes.func,
  onTestWebSearch: PropTypes.func,
  isTesting: PropTypes.bool,
  isTestingWebSearch: PropTypes.bool,
  onDisable: PropTypes.func,
  caps: PropTypes.object,
  thinkingSuffix: PropTypes.string,
};
