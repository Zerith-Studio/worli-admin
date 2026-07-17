// ============================================
// FILE: lib/rows-per-load.js
// How many rows each list loads per batch, as a single panel-wide preference.
//
// A tiny external store rather than a prop threaded through 20 pages: the
// selector and every list that reads the value are far apart in the tree, and
// the choice is a user preference rather than page state — someone who picks
// 100 wants 100 everywhere, and still wants it tomorrow.
// ============================================

import { useSyncExternalStore } from "react"

const STORAGE_KEY = "worli_rows_per_load"

export const ROWS_PER_LOAD_OPTIONS = [20, 50, 100]
const DEFAULT_ROWS_PER_LOAD = 20

function read() {
  try {
    const n = parseInt(localStorage.getItem(STORAGE_KEY), 10)
    return ROWS_PER_LOAD_OPTIONS.includes(n) ? n : DEFAULT_ROWS_PER_LOAD
  } catch {
    // Private mode / storage disabled — the preference just doesn't persist.
    return DEFAULT_ROWS_PER_LOAD
  }
}

let current = read()
const listeners = new Set()

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => current

export function setRowsPerLoad(n) {
  if (!ROWS_PER_LOAD_OPTIONS.includes(n) || n === current) return
  current = n
  try {
    localStorage.setItem(STORAGE_KEY, String(n))
  } catch {
    // Non-fatal: the value still applies for this session.
  }
  listeners.forEach((l) => l())
}

/** The current batch size. Re-renders consumers when it changes. */
export function useRowsPerLoad() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
