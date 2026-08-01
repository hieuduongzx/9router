"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "router2k.sidebarCollapsed";

/**
 * Collapsed state for the desktop sidebar rail, persisted to localStorage.
 *
 * Read through `useSyncExternalStore` rather than a `useState` initializer: the
 * dashboard shell is server-rendered, so reading localStorage during the first
 * client render would make the markup disagree with the server's and trip a
 * hydration error. `getServerSnapshot` pins that first pass to "expanded", then
 * React re-renders with the stored value once hydrated.
 *
 * The store is module-level so the desktop rail and the mobile drawer — two
 * separate Sidebar instances — always agree.
 */
const listeners = new Set();
let cached = null;

function readStored() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getSnapshot() {
  if (cached === null) cached = readStored();
  return cached;
}

function getServerSnapshot() {
  return false;
}

function subscribe(onChange) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setCollapsed = useCallback((next) => {
    const value = typeof next === "function" ? Boolean(next(getSnapshot())) : Boolean(next);
    if (value === cached) return;
    cached = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* private mode / storage disabled — collapse still works for this session */
    }
    listeners.forEach((onChange) => onChange());
  }, []);

  return [collapsed, setCollapsed];
}
