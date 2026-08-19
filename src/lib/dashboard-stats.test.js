import { describe, expect, it } from "vitest";
import { fetchDashboardStats } from "./dashboard-stats";
import { istToday } from "../utils/formatters";

// Minimal PostgREST-builder fake: chainable, thenable, and it hands the
// recorded query to `respond` so each test decides what comes back.
function makeClient(respond) {
  return {
    from(table) {
      const q = { table, select: null, opts: undefined, filters: [] };
      const record = (op) => (...args) => {
        q.filters.push([op, ...args]);
        return builder;
      };
      const builder = {
        select(cols, opts) {
          q.select = cols;
          q.opts = opts;
          return builder;
        },
        eq: record("eq"),
        lt: record("lt"),
        gte: record("gte"),
        lte: record("lte"),
        in: record("in"),
        range: record("range"),
        order: record("order"),
        then(onFulfilled, onRejected) {
          return Promise.resolve(respond(q)).then(onFulfilled, onRejected);
        },
      };
      return builder;
    },
  };
}

const has = (q, op, col) => q.filters.some(([o, c]) => o === op && c === col);
const val = (q, op, col) => q.filters.find(([o, c]) => o === op && c === col)?.[2];

const TODAY_ROWS = [
  { status: "delivered", amount: 100, addresses: { city: "Worli" } },
  { status: "failed", amount: 50, addresses: { city: "Worli" } },
  { status: "pending", amount: 30, addresses: null },
];

function happyPath(q) {
  if (q.table === "users") return { count: 42, error: null };
  if (q.table === "subscriptions") {
    if (val(q, "eq", "status") === "active") return { count: 7, error: null };
    return { count: 3, error: null };
  }
  if (q.table === "wallets") {
    // Bounded server-side counts, never a full row fetch.
    if (!q.opts?.head) throw new Error("wallets must be counted, not fetched");
    if (has(q, "gte", "balance")) return { count: 5, error: null };
    return { count: 1, error: null };
  }
  if (q.table === "orders") {
    if (q.opts?.head) {
      // Per-day delivered counts for the week chart.
      return { count: val(q, "eq", "delivery_date") === istToday() ? 2 : 0, error: null };
    }
    return { data: TODAY_ROWS, error: null };
  }
  throw new Error(`unexpected table ${q.table}`);
}

describe("fetchDashboardStats", () => {
  it("aggregates the happy path from bounded queries", async () => {
    const stats = await fetchDashboardStats(makeClient(happyPath));
    expect(stats.totalCustomers).toBe(42);
    expect(stats.activeSubscriptions).toBe(7);
    expect(stats.pausedCustomers).toBe(3);
    expect(stats.todayOrders).toBe(3);
    expect(stats.todayDelivered).toBe(1);
    expect(stats.todayFailed).toBe(1);
    expect(stats.todayPending).toBe(1);
    expect(stats.todayRevenue).toBe(100);
    expect(stats.todayOrderValue).toBe(180);
    expect(stats.deliveryPct).toBe(33);
    expect(stats.lowBalanceCount).toBe(1);
    expect(stats.atRiskCustomers).toBe(5);
    expect(stats.zoneStats).toContainEqual({ zone: "Worli", total: 2, done: 1 });
    expect(stats.zoneStats).toContainEqual({ zone: "Unknown", total: 1, done: 0 });
    expect(stats.weekData).toEqual([0, 0, 0, 0, 0, 0, 2]);
  });

  it("pages through today's orders past the PostgREST row ceiling", async () => {
    const client = makeClient((q) => {
      if (q.table === "orders" && !q.opts?.head) {
        const from = q.filters.find(([o]) => o === "range")?.[1];
        expect(from).toBeDefined();
        const rows =
          from === 0
            ? Array.from({ length: 1000 }, () => ({ status: "delivered", amount: 1, addresses: null }))
            : Array.from({ length: 500 }, () => ({ status: "pending", amount: 1, addresses: null }));
        return { data: rows, error: null };
      }
      return happyPath(q);
    });
    const stats = await fetchDashboardStats(client);
    expect(stats.todayOrders).toBe(1500);
    expect(stats.todayDelivered).toBe(1000);
    expect(stats.todayOrderValue).toBe(1500);
  });

  it("throws when a query fails instead of rendering confident zeros", async () => {
    const client = makeClient((q) => {
      if (q.table === "wallets") {
        return { count: null, error: { message: "permission denied for table wallets" } };
      }
      return happyPath(q);
    });
    await expect(fetchDashboardStats(client)).rejects.toThrow(
      /permission denied for table wallets/
    );
  });

  it("throws when a count query fails", async () => {
    const client = makeClient((q) => {
      if (q.table === "users") {
        return { count: null, error: { message: "JWT expired" } };
      }
      return happyPath(q);
    });
    await expect(fetchDashboardStats(client)).rejects.toThrow(/JWT expired/);
  });

  it("throws when a page of today's orders fails", async () => {
    const client = makeClient((q) => {
      if (q.table === "orders" && !q.opts?.head) {
        return { data: null, error: { message: "canceling statement due to timeout" } };
      }
      return happyPath(q);
    });
    await expect(fetchDashboardStats(client)).rejects.toThrow(/timeout/);
  });
});
