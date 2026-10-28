import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReport,
  defaultSelection,
  percentChange,
  exportReport,
} from "../src/analytics.js";
import { createSampleDataset } from "../src/sample.js";
import { parseCSV } from "../src/csv.js";
import { dataset, line } from "./helpers.js";
const selection = {
  start: "2026-10-20",
  end: "2026-10-20",
  channel: "all",
  category: "all",
};
test("calculates money in cents with discounts and refunds applied once", () => {
  const report = buildReport(dataset(), selection);
  assert.deepEqual(report.current, {
    gross: 20000,
    discounts: 2000,
    refunds: 3000,
    net: 15000,
    orders: 1,
    units: 2,
    aov: 15000,
    refundRate: 1 / 6,
  });
});
test("counts an order once across multiple lines and excludes pending/cancelled lines", () => {
  const report = buildReport(
    dataset([
      line(),
      line({
        lineId: "L-2",
        sku: "TENT",
        product: "Trail Tent",
        quantity: 1,
        unitPrice: 20000,
        discount: 0,
        refund: 0,
      }),
      line({ lineId: "L-3", orderId: "O-2", status: "pending", refund: 0 }),
      line({ lineId: "L-4", orderId: "O-3", status: "cancelled", refund: 0 }),
    ]),
    selection,
  );
  assert.equal(report.current.orders, 1);
  assert.equal(report.current.net, 35000);
  assert.equal(report.excludedLines, 2);
});
test("fully refunded paid orders remain in order count with zero net sales", () => {
  const report = buildReport(dataset([line({ refund: 18000 })]), selection);
  assert.equal(report.current.orders, 1);
  assert.equal(report.current.net, 0);
  assert.equal(report.current.aov, 0);
});
test("zero activity yields null ratios, zero totals and a complete date axis", () => {
  const report = buildReport(dataset(), {
    ...selection,
    start: "2026-10-21",
    end: "2026-10-23",
  });
  assert.equal(report.current.aov, null);
  assert.equal(report.current.refundRate, null);
  assert.deepEqual(
    report.daily.map((d) => d.net),
    [0, 0, 0],
  );
  assert.deepEqual(report.products, []);
});
test("date windows are inclusive and comparisons have equal length without overlap", () => {
  const data = dataset([
    line({ date: "2026-10-18" }),
    line({ lineId: "L-2", orderId: "O-2", date: "2026-10-19" }),
    line({ lineId: "L-3", orderId: "O-3", date: "2026-10-20" }),
  ]);
  const report = buildReport(data, selection);
  assert.equal(report.comparison.start, "2026-10-19");
  assert.equal(report.comparison.end, "2026-10-19");
  assert.equal(report.previous?.orders, 1);
  assert.equal(report.current.orders, 1);
});
test("suppresses comparisons when the imported date coverage is incomplete", () => {
  assert.equal(buildReport(dataset(), selection).previous, null);
  assert.equal(buildReport(dataset(), selection).comparison.available, false);
});
test("product and channel filters affect totals and comparison consistently", () => {
  const data = dataset([
    line(),
    line({
      lineId: "L-2",
      orderId: "O-2",
      sku: "TENT",
      product: "Trail Tent",
      category: "Shelter",
      channel: "Marketplace",
    }),
  ]);
  assert.equal(
    buildReport(data, { ...selection, category: "Shelter" }).current.orders,
    1,
  );
  assert.equal(
    buildReport(data, { ...selection, channel: "Marketplace" }).products[0]
      ?.sku,
    "TENT",
  );
  assert.equal(
    buildReport(data, { ...selection, channel: "Missing" }).current.orders,
    0,
  );
});
test("category-filtered average uses only matching line sales and distinct matching orders", () => {
  const data = dataset([
    line(),
    line({
      lineId: "L-2",
      sku: "TENT",
      product: "Trail Tent",
      category: "Shelter",
      quantity: 1,
      discount: 0,
      refund: 0,
    }),
  ]);
  const report = buildReport(data, { ...selection, category: "Packs" });
  assert.equal(report.current.aov, 15000);
  assert.equal(report.current.orders, 1);
});
test("daily, product and category amounts reconcile exactly to the report total", () => {
  const data = createSampleDataset();
  const report = buildReport(data, defaultSelection(data));
  for (const rows of [report.daily, report.products, report.categories])
    assert.equal(
      rows.reduce((n, r) => n + r.net, 0),
      report.current.net,
    );
  assert.equal(
    report.daily.reduce((n, d) => n + d.orders, 0),
    report.current.orders,
  );
  assert.ok(
    Math.abs(report.products.reduce((n, p) => n + (p.share ?? 0), 0) - 1) <
      1e-12,
  );
});
test("report preserves rank and supports exact integer amounts with large line values", () => {
  const report = buildReport(
    dataset([
      line({ unitPrice: 999999999, quantity: 10000, discount: 1, refund: 2 }),
    ]),
    selection,
  );
  assert.equal(report.current.net, 9999999989997);
  assert.ok(Number.isSafeInteger(report.current.net));
});
test("invalid and excessively long reporting windows reject", () => {
  for (const range of [
    { start: "2026-10-22", end: "2026-10-20" },
    { start: "2025-01-01", end: "2026-10-20" },
    { start: "2026-02-30", end: "2026-03-01" },
  ])
    assert.throws(() => buildReport(dataset(), { ...selection, ...range }));
});
test("percentage changes never manufacture an infinite lift or a comparison without a baseline", () => {
  assert.equal(percentChange(100, null), null);
  assert.equal(percentChange(100, 0), null);
  assert.equal(percentChange(150, 100), 0.5);
  assert.equal(percentChange(0, 100), -1);
});
test("exported product report carries period/filter/currency context and exact decimal sales", () => {
  const report = buildReport(dataset(), selection);
  const rows = parseCSV(exportReport(report));
  assert.equal(rows[1]?.[0], "2026-10-20");
  assert.equal(rows[1]?.[10], "150.00");
  assert.equal(rows[1]?.[11], "30.00");
});
