import { test } from "node:test";
import assert from "node:assert/strict";
import {
  importCSV,
  exportOrders,
  parseCSV,
  csvCell,
  HEADERS,
} from "../src/csv.js";
import {
  cents,
  decimal,
  dayNumber,
  shiftDate,
  datasetFromLines,
} from "../src/model.js";
import { line } from "./helpers.js";
test("parses BOM, CRLF, quotes, commas and embedded newlines", () => {
  assert.deepEqual(
    parseCSV(
      '\ufeffa,b\r\n"hello, world","two""quotes"\r\n"multi\nline",end\r\n',
    ),
    [
      ["a", "b"],
      ["hello, world", 'two"quotes'],
      ["multi\nline", "end"],
    ],
  );
});
test("rejects malformed quoting and oversized files", () => {
  for (const value of ['a,"unfinished', 'a,b"c', '"x"bad,y'])
    assert.throws(() => parseCSV(value));
  assert.throws(() => parseCSV("é".repeat(3 * 1024 * 1024)), /5 MB/);
});
test("imports a complete order-line file and ignores unrelated columns", () => {
  const csv = exportOrders([line()]);
  const imported = importCSV(csv);
  assert.deepEqual(imported.lines, [line()]);
  const withExtra = csv
    .replace("currency\r\n", "currency,unrelated\r\n")
    .replace("AUD\r\n", "AUD,ignored\r\n");
  assert.deepEqual(importCSV(withExtra).ignoredColumns, ["unrelated"]);
  assert.equal(
    Object.keys(importCSV(withExtra).lines[0]!).includes("unrelated"),
    false,
  );
});
test("empty files, duplicate headings, missing headings and mismatched rows reject atomically", () => {
  for (const value of [
    "",
    "order_id\nO-1\n",
    HEADERS.join(",") + ",date\n",
    exportOrders([line()]).replace("AUD\r\n", "AUD,extra\r\n"),
  ])
    assert.throws(() => importCSV(value));
});
test("blank required values and invalid money/quantity are rejected with row numbers", () => {
  const valid = exportOrders([line()]);
  for (const value of [
    valid.replace("Trail Pack", ""),
    valid.replace(",2,100.00", ",1.5,100.00"),
    valid.replace("100.00", "100.001"),
  ])
    assert.throws(() => importCSV(value), /Row 2/);
});
test("duplicate line IDs reject instead of silently inflating revenue", () => {
  assert.throws(() => datasetFromLines([line(), line()]), /duplicated/);
});
test("inconsistent order metadata, SKU metadata and mixed currencies reject", () => {
  for (const second of [
    line({ lineId: "L-2", date: "2026-10-21" }),
    line({ lineId: "L-2", orderId: "O-2", product: "Renamed" }),
    line({ lineId: "L-2", orderId: "O-2", currency: "USD" }),
  ])
    assert.throws(() => datasetFromLines([line(), second]));
});
test("refund and discount bounds prevent impossible sales", () => {
  for (const patch of [
    { discount: 20001 },
    { refund: 18001 },
    { quantity: 0 },
    { unitPrice: -1 },
    { status: "other" as "paid" },
    { currency: "aud" },
    { date: "2026-02-30" },
  ])
    assert.throws(() => datasetFromLines([line(patch)]));
});
test("zero and three decimal currencies cannot silently round reported amounts", () => {
  for (const currency of ["JPY", "BHD"])
    assert.throws(() => datasetFromLines([line({ currency })]), /two decimal/);
});
test("unpaid refunds and unsafe aggregate totals reject before reporting", () => {
  assert.throws(
    () => datasetFromLines([line({ status: "pending" })]),
    /Only paid/,
  );
  assert.throws(
    () =>
      datasetFromLines(
        Array.from({ length: 10 }, (_, index) =>
          line({
            lineId: `L-${index}`,
            orderId: `O-${index}`,
            quantity: 10000,
            unitPrice: 99999999999,
            discount: 0,
            refund: 0,
          }),
        ),
      ),
    /safe integer/,
  );
});
test("decimal conversion is exact and rejects exponents, symbols, negatives and excess precision", () => {
  assert.equal(cents("0.01"), 1);
  assert.equal(cents("29.9"), 2990);
  assert.equal(decimal(2999), "29.99");
  assert.equal(decimal(-1), "-0.01");
  for (const value of ["1e3", "$1", "-1", "1.001", "NaN"])
    assert.throws(() => cents(value));
  assert.throws(() => decimal(0.1));
});
test("calendar arithmetic respects leap days without host timezone assumptions", () => {
  assert.equal(shiftDate("2028-02-28", 1), "2028-02-29");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  assert.throws(() => dayNumber("2026-02-29"));
  assert.throws(() => dayNumber("28/10/2026"));
  assert.throws(() => shiftDate("2026-10-28", 0.5));
});
test("CSV export escapes spreadsheet formulas and quotes delimiters safely", () => {
  for (const value of ["=SUM(A1)", "+1", "-cmd", "@formula", " \t=FORMULA"])
    assert.ok(csvCell(value).startsWith("'"));
  assert.equal(csvCell('hello, "world"'), '"hello, ""world"""');
  assert.equal(csvCell(123), "123");
});
test("unsafe characters and unsupported data volumes fail before aggregation", () => {
  assert.throws(() => datasetFromLines([line({ sku: "bad\u0000sku" })]));
  assert.throws(() => datasetFromLines([]));
  assert.throws(() =>
    datasetFromLines(Array.from({ length: 50001 }, () => line())),
  );
});
