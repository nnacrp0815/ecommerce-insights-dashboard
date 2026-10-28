import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createSampleDataset } from "../src/sample.js";
import { buildReport, defaultSelection } from "../src/analytics.js";
import { importCSV } from "../src/csv.js";
type BrowserAPI = {
  createSampleDataset: typeof createSampleDataset;
  buildReport: typeof buildReport;
  defaultSelection: typeof defaultSelection;
};
test("browser bundle runs the shared report logic without a network or module loader", () => {
  const window: { RetailInsights?: BrowserAPI } = {};
  runInNewContext(readFileSync("public/core.js", "utf8"), { window });
  const browser = window.RetailInsights!,
    data = browser.createSampleDataset();
  const actual = browser.buildReport(data, browser.defaultSelection(data));
  const source = createSampleDataset(),
    expected = buildReport(source, defaultSelection(source));
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
});
test("sample CSV imports into the same deterministic outdoor-retail dataset", () => {
  const fixture = importCSV(
    readFileSync("fixtures/summit-pine-orders.csv", "utf8"),
  );
  assert.deepEqual(fixture.lines, createSampleDataset().lines);
  assert.equal(new Set(fixture.lines.map((l) => l.sku)).size, 8);
  assert.equal(fixture.coverage.start, "2026-07-31");
  assert.equal(fixture.coverage.end, "2026-10-28");
});
test("portable demo includes its own assets and does not load third-party code or fonts", () => {
  const html = readFileSync("demo.html", "utf8");
  assert.ok(html.includes("<style>"));
  assert.ok(html.includes("window.RetailInsights"));
  assert.ok(html.includes("Know what’s moving your store."));
  assert.equal(/<script[^>]+src=/.test(html), false);
  assert.equal(/<link[^>]+rel="stylesheet"/.test(html), false);
  assert.equal(html.includes("fonts.googleapis.com"), false);
});
test("directory preview uses portable relative asset paths", () => {
  const html = readFileSync("public/index.html", "utf8");
  for (const asset of ["style.css", "core.js", "app.js"])
    assert.ok(html.includes(`"./${asset}"`));
});
