"use client";

import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, FlaskConical, Copy, Check, X, Loader2 } from "lucide-react";

/**
 * Available Models list view.
 *
 * Replaces the old chip-wrap layout with a searchable + sortable list.
 * Items keep the same actions (copy, test, disable/remove) that the
 * legacy `ModelRow` chip exposed.
 *
 * Data shape (each item):
 *   {
 *     id: string,                    // model id (without provider prefix)
 *     fullModel: string,             // "<providerAlias>/<id>"
 *     name?: string,                 // human label
 *     isFree?: boolean,
 *     isCustom?: boolean,            // user-added via alias
 *     testStatus?: "ok" | "error",
 *     onTest?: () => void,           // optional; if absent test column hidden
 *     onRemove?: () => void,         // disable / remove
 *     removeTitle?: string,
 *   }
 */
function SortIcon({ active, dir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

SortIcon.propTypes = {
  active: PropTypes.bool,
  dir: PropTypes.oneOf(["asc", "desc"]),
};

export default function ModelListView({
  items,
  copied,
  onCopy,
  testingModelId,
  testingAll,
  emptyText = "No models",
  rightHeaderSlot,
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("default"); // default | name | status
  const [sortDir, setSortDir] = useState("asc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => {
      const haystack = `${m.id} ${m.fullModel} ${m.name || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  const sorted = useMemo(() => {
    if (sortKey === "default") return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av, bv;
      if (sortKey === "name") {
        av = (a.name || a.id || "").toLowerCase();
        bv = (b.name || b.id || "").toLowerCase();
      } else if (sortKey === "status") {
        // ok=2, none=1, error=0 (descending preferred default)
        const score = (s) => (s === "ok" ? 2 : s === "error" ? 0 : 1);
        av = score(a.testStatus);
        bv = score(b.testStatus);
      } else {
        av = a.id;
        bv = b.id;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else {
        setSortKey("default");
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: search + sort + slot for extra actions (Test All, etc.) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models..."
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {sorted.length}
            {sorted.length !== items.length ? ` / ${items.length}` : ""}
          </span>
          {rightHeaderSlot}
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <span className="w-4 shrink-0" />
        <button
          type="button"
          onClick={() => toggleSort("name")}
          className="flex flex-1 items-center gap-1 hover:text-foreground transition-colors"
        >
          Model
          <SortIcon active={sortKey === "name"} dir={sortDir} />
        </button>
        <button
          type="button"
          onClick={() => toggleSort("status")}
          className="flex w-20 items-center justify-end gap-1 hover:text-foreground transition-colors"
        >
          Status
          <SortIcon active={sortKey === "status"} dir={sortDir} />
        </button>
        <span className="w-24 text-right">Actions</span>
      </div>

      {/* Rows */}
      {sorted.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          {query ? `No models match "${query}"` : emptyText}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-md border border-border overflow-hidden">
          {sorted.map((m) => (
            <ModelListRow
              key={`${m.fullModel}-${m.isCustom ? "c" : "b"}`}
              item={m}
              copied={copied}
              onCopy={onCopy}
              isTesting={testingAll || testingModelId === m.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

ModelListView.propTypes = {
  items: PropTypes.array.isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  testingModelId: PropTypes.string,
  testingAll: PropTypes.bool,
  emptyText: PropTypes.string,
  rightHeaderSlot: PropTypes.node,
};

function ModelListRow({ item, copied, onCopy, isTesting }) {
  const { id, fullModel, name, isFree, isCustom, testStatus, onTest, onRemove, removeTitle } = item;

  const statusIcon =
    testStatus === "ok" ? (
      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" title="Healthy" />
    ) : testStatus === "error" ? (
      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-red-500" title="Unreachable" />
    ) : (
      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-muted-foreground/30" title="Unknown" />
    );

  const isCopied = copied === `model-${id}`;

  return (
    <div className="group flex items-center gap-2 bg-background px-3 py-2.5 hover:bg-accent/40 transition-colors">
      {/* Status dot */}
      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
        {statusIcon}
      </div>

      {/* Model id + name */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <code className="truncate font-mono text-sm text-foreground">{fullModel}</code>
        {name && name !== id && (
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            {name}
          </span>
        )}
        {isFree && (
          <span className="shrink-0 rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-600 dark:text-emerald-400">
            FREE
          </span>
        )}
        {isCustom && (
          <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
            CUSTOM
          </span>
        )}
      </div>

      {/* Status text (sm+) */}
      <div className="hidden w-20 items-center justify-end text-xs text-muted-foreground sm:flex">
        {testStatus === "ok" && <span className="text-emerald-600 dark:text-emerald-400">healthy</span>}
        {testStatus === "error" && <span className="text-red-500">error</span>}
        {!testStatus && <span className="text-muted-foreground/50">—</span>}
      </div>

      {/* Actions */}
      <div className="flex w-24 items-center justify-end gap-0.5">
        {onTest && (
          <button
            type="button"
            onClick={onTest}
            disabled={isTesting}
            title={isTesting ? "Testing..." : "Test model"}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4" />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => onCopy(fullModel, `model-${id}`)}
          title={isCopied ? "Copied" : "Copy model id"}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title={removeTitle || (isCustom ? "Remove" : "Disable")}
            className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

ModelListRow.propTypes = {
  item: PropTypes.object.isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  isTesting: PropTypes.bool,
};
