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

const val = (q, op, col) => q.filters.find(([o, c]) => o === op && c === col)?.[2];

function happyPath(q) {
  if (q.table === "users") return { count: 42, error: null };
  if (q.table === "subscriptions") {
    if (val(q, "eq", "status") === "active") return { count: 7, error: null };
    return { count: 3, error: null };
  }
  if (q.table === "wallets") return { data: [{ balance: 100 }, { balance: 500 }], error: null };
  if (q.table === "orders") {
    if (q.select.includes("addresses")) {
      return {
        data: [
          { status: "delivered", amount: 100, addresses: { city: "Worli" } },
          { status: "failed", amount: 50, addresses: { city: "Worli" } },
          { status: "pending", amount: 30, addresses: null },
        ],
        error: null,
      };
    }
    if (q.select.includes("delivery_date")) {
      return { data: [{ delivery_date: istToday() }], error: null };
    }
    return {
      data: [
        { status: "delivered", amount: 100 },
        { status: "failed", amount: 50 },
        { status: "pending", amount: 30 },
      ],
      error: null,
    };
  }
  throw new Error(`unexpected table ${q.table}`);
}

describe("fetchDashboardStats", () => {
  it("aggregates the happy path", async () => {
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
    expect(stats.zoneStats).toContainEqual({ zone: "Worli", total: 2, done: 1 });
    expect(stats.weekData).toHaveLength(7);
    expect(stats.weekData[6]).toBe(1);
  });

  it("throws when a query fails instead of rendering confident zeros", async () => {
    const client = makeClient((q) => {
      if (q.table === "wallets") {
        return { data: null, error: { message: "permission denied for table wallets" } };
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
});
