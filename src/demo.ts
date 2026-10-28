import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importCSV } from "./csv.js";
import { buildReport, defaultSelection, exportReport } from "./analytics.js";
const data = importCSV(readFileSync("fixtures/summit-pine-orders.csv", "utf8"));
const report = buildReport(data, defaultSelection(data));
assert.equal(
  report.products.reduce((n, p) => n + p.net, 0),
  report.current.net,
);
assert.equal(
  report.daily.reduce((n, d) => n + d.net, 0),
  report.current.net,
);
assert.ok(report.current.orders > 0);
assert.equal(report.products.length, 8);
assert.ok(report.previous);
assert.ok(exportReport(report).includes("net_product_sales"));
console.table([
  {
    period: `${report.selection.start} to ${report.selection.end}`,
    currency: report.currency,
    netSales: (report.current.net / 100).toFixed(2),
    paidOrders: report.current.orders,
    refunds: (report.current.refunds / 100).toFixed(2),
    products: report.products.length,
  },
]);
console.log(
  `PASS: ${data.lines.length} fictional order lines imported; money, daily sales, product totals and CSV report reconcile. No accounts, store credentials or external requests.`,
);
