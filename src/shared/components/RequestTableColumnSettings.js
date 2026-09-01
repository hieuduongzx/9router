"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import PropTypes from "prop-types";
import Toggle from "./Toggle";
import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/ui/icon";

export const REQUEST_TABLE_COLUMN_STORAGE_KEY = "9router.requestTable.columns";

export const HISTORY_COLUMNS = [
  { id: "time", label: "Time", defaultVisible: true, align: "left" },
  { id: "apiKey", label: "API key", defaultVisible: false, align: "left" },
  { id: "input", label: "Input Tokens", defaultVisible: true, align: "right" },
  { id: "cached", label: "Cached", defaultVisible: true, align: "right" },
  { id: "cacheWrite", label: "Cache write", defaultVisible: false, align: "right" },
  { id: "output", label: "Output Tokens", defaultVisible: true, align: "right" },
  { id: "timing", label: "Timing", defaultVisible: true, align: "right" },
  { id: "model", label: "Model", defaultVisible: true, align: "left" },
  { id: "mode", label: "Mode", defaultVisible: true, align: "left" },
  { id: "status", label: "Status", defaultVisible: true, align: "left" },
  { id: "credits", label: "Credits", defaultVisible: true, align: "right" },
  { id: "trace", label: "Trace ID", defaultVisible: true, align: "left" },
];

export const ACTIVITY_COLUMNS = [
  { id: "time", label: "Time", defaultVisible: true, align: "left" },
  { id: "account", label: "Account", defaultVisible: true, align: "left" },
  { id: "apiKey", label: "API key", defaultVisible: false, align: "left" },
  { id: "cost", label: "Total Cost", defaultVisible: true, align: "left" },
  { id: "input", label: "Input Tokens", defaultVisible: true, align: "left" },
  { id: "cached", label: "Cached", defaultVisible: true, align: "left" },
  { id: "cacheWrite", label: "Cache write", defaultVisible: false, align: "left" },
  { id: "output", label: "Output Tokens", defaultVisible: true, align: "left" },
  { id: "timing", label: "Timing", defaultVisible: true, align: "left" },
  { id: "model", label: "Model", defaultVisible: true, align: "left" },
  { id: "mode", label: "Mode", defaultVisible: true, align: "left" },
  { id: "status", label: "Status", defaultVisible: true, align: "left" },
];

const DEFAULT_COLUMNS = {
  history: Object.fromEntries(HISTORY_COLUMNS.map((column) => [column.id, column.defaultVisible])),
  activity: Object.fromEntries(ACTIVITY_COLUMNS.map((column) => [column.id, column.defaultVisible])),
};

const SERVER_SNAPSHOT = Object.freeze({
  history: Object.freeze({ ...DEFAULT_COLUMNS.history }),
  activity: Object.freeze({ ...DEFAULT_COLUMNS.activity }),
});

const listeners = new Set();
let cachedPrefs = null;

function cloneDefaults() {
  return {
    history: { ...DEFAULT_COLUMNS.history },
    activity: { ...DEFAULT_COLUMNS.activity },
  };
}

function normalizeTablePrefs(stored, table) {
  const defaults = DEFAULT_COLUMNS[table];
  const source = stored && typeof stored === "object" ? stored : {};
  const next = {};
  for (const id of Object.keys(defaults)) {
    next[id] = typeof source[id] === "boolean" ? source[id] : defaults[id];
  }
  return next;
}

function normalizePrefs(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    history: normalizeTablePrefs(source.history, "history"),
    activity: normalizeTablePrefs(source.activity, "activity"),
  };
}

function readStoredPrefs() {
  if (typeof window === "undefined") return cloneDefaults();
  try {
    const raw = window.localStorage.getItem(REQUEST_TABLE_COLUMN_STORAGE_KEY);
    return normalizePrefs(raw ? JSON.parse(raw) : null);
  } catch {
    return cloneDefaults();
  }
}

function getSnapshot() {
  if (cachedPrefs === null) cachedPrefs = readStoredPrefs();
  return cachedPrefs;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}
function subscribe(onChange) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function writePrefs(next) {
  cachedPrefs = next;
  try {
    window.localStorage.setItem(REQUEST_TABLE_COLUMN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / storage disabled — prefs still apply for this session */
  }
  listeners.forEach((onChange) => onChange());
}

export function useRequestTableColumns(table) {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const columns = table === "activity" ? ACTIVITY_COLUMNS : HISTORY_COLUMNS;
  const visibility = useMemo(
    () => normalizeTablePrefs(prefs[table], table),
    [prefs, table],
  );

  const setColumnVisible = (id, visible) => {
    const current = getSnapshot();
    writePrefs({
      ...current,
      [table]: {
        ...normalizeTablePrefs(current[table], table),
        [id]: Boolean(visible),
      },
    });
  };

  return { columns, visibility, setColumnVisible };
}

export default function RequestTableColumnSettings({ table, className }) {
  const { columns, visibility, setColumnVisible } = useRequestTableColumns(table);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border bg-surface px-2.5 font-mono text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
        title="Choose which columns to show"
      >
        <Icon name="tune" className="size-[16px]" aria-hidden />
        Columns
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Table columns"
          className="absolute right-0 z-20 mt-1 w-56 rounded-sm border border-border bg-surface p-2 shadow-lg"
        >
          <p className="px-1 pb-2 text-xs font-medium text-muted-foreground tracking-wide text-muted-foreground">Visible columns</p>
          <ul className="flex flex-col gap-1">
            {columns.map((column) => (
              <li key={column.id} role="none">
                <Toggle
                  size="sm"
                  className="w-full flex-row-reverse justify-between px-1 py-1"
                  checked={visibility[column.id] !== false}
                  onChange={(checked) => setColumnVisible(column.id, checked)}
                  label={column.label}
                  ariaLabel={`Show ${column.label} column`}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

RequestTableColumnSettings.propTypes = {
  table: PropTypes.oneOf(["history", "activity"]).isRequired,
  className: PropTypes.string,
};
