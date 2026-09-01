import PropTypes from "prop-types";
import { CapacityBadges } from "@/shared/components";
import { Icon } from "@/shared/components/ui/icon";

export default function ModelRow({
  model,
  fullModel,
  alias,
  copied,
  onCopy,
  testStatus,
  isCustom,
  isFree,
  onDeleteAlias,
  onTest,
  isTesting,
  onDisable,
  caps,
}) {
  const displayModel = fullModel;
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
  const isAnyTestRunning = isTesting;

  return (
    <div
      role="listitem"
      className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-1.5 transition-colors hover:bg-sidebar/50 focus-within:bg-sidebar/50"
    >
      <Icon name={testStatus === "ok" ? "check_circle" : testStatus === "error" ? "cancel" : "smart_toy"} className="size-[18px] text-muted-foreground" style={iconColor ? { color: iconColor } : undefined} title={testStatus === "ok" ? "Model test passed" : testStatus === "error" ? "Model test failed" : "Model"} />

      <div className="min-w-0 py-1">
        <code className="block truncate font-mono text-sm font-medium text-foreground" title={displayModel}>
          {displayModel}
        </code>
        {(hasSecondaryName || caps) && (
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
            {hasSecondaryName && (
              <span className="truncate text-xs text-muted-foreground">{model.name}</span>
            )}
            <CapacityBadges caps={runtimeSafeCaps} colorOverride="text-muted-foreground/70" size={12} />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {onTest && (
          <button
            type="button"
            onClick={onTest}
            disabled={isAnyTestRunning}
            className="inline-flex size-11 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-wait disabled:opacity-60"
            title={isTesting ? "Testing model" : "Test model"}
            aria-label={isTesting ? `Testing ${displayModel}` : `Test ${displayModel}`}
          >
            <Icon name={isTesting ? "progress_activity" : "science"} className={`size-4 ${isTesting ? "animate-spin motion-reduce:animate-none" : ""}`} />
          </button>
        )}

        <button
          type="button"
          onClick={() => onCopy(displayModel, copyKey)}
          className="inline-flex size-11 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          title={copied === copyKey ? "Copied" : "Copy model ID"}
          aria-label={copied === copyKey ? `Copied ${displayModel}` : `Copy ${displayModel}`}
        >
          <Icon name={copied === copyKey ? "check" : "content_copy"} className="size-4" />
        </button>

        {isCustom ? (
          <button
            type="button"
            onClick={onDeleteAlias}
            className="inline-flex size-11 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
            title="Remove custom model"
            aria-label={`Remove ${displayModel}`}
          >
            <Icon name="delete" className="size-4" />
          </button>
        ) : onDisable ? (
          <button
            type="button"
            onClick={onDisable}
            className="inline-flex size-11 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
            title="Disable model"
            aria-label={`Disable ${displayModel}`}
          >
            <Icon name="block" className="size-4" />
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
  isCustom: PropTypes.bool,
  isFree: PropTypes.bool,
  onDeleteAlias: PropTypes.func,
  onTest: PropTypes.func,
  isTesting: PropTypes.bool,
  onDisable: PropTypes.func,
  caps: PropTypes.object,
};
