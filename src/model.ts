export type Status = "paid" | "pending" | "cancelled";
export type OrderLine = {
  lineId: string;
  orderId: string;
  date: string;
  sku: string;
  product: string;
  category: string;
  channel: string;
  status: Status;
  quantity: number;
  unitPrice: number;
  discount: number;
  refund: number;
  currency: string;
};
export type Dataset = {
  lines: OrderLine[];
  coverage: { start: string; end: string };
  source: "sample" | "import";
  ignoredColumns: string[];
};
export type Selection = {
  start: string;
  end: string;
  channel: string;
  category: string;
};
export const DAY = 86400000;
export function dayNumber(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Use a date in YYYY-MM-DD format.");
  const time = Date.parse(value + "T00:00:00Z");
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    throw new Error("That calendar date is invalid.");
  return time / DAY;
}
export function shiftDate(value: string, days: number): string {
  if (!Number.isSafeInteger(days))
    throw new Error("Date offsets must be whole days.");
  return new Date((dayNumber(value) + days) * DAY).toISOString().slice(0, 10);
}
export function cents(value: string): number {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value))
    throw new Error(
      "Money must be a non-negative decimal with at most two decimal places, without a currency symbol.",
    );
  const [whole, part = ""] = value.split(".");
  return Number(whole) * 100 + Number(part.padEnd(2, "0"));
}
export function decimal(value: number): string {
  if (!Number.isSafeInteger(value))
    throw new Error("Money must be stored as integer cents.");
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
export function validateLines(lines: OrderLine[]): void {
  if (!lines.length || lines.length > 50000)
    throw new Error("Use a file with between 1 and 50,000 order lines.");
  const ids = new Set<string>();
  const orders = new Map<string, string>();
  const currencies = new Set<string>();
  const products = new Map<string, string>();
  let totalGross = 0;
  for (const [index, line] of lines.entries()) {
    const row = `Row ${index + 2}: `;
    const fail = (message: string): never => {
      throw new Error(row + message);
    };
    for (const field of [
      "lineId",
      "orderId",
      "sku",
      "product",
      "category",
      "channel",
    ] as const)
      if (
        typeof line[field] !== "string" ||
        !line[field].trim() ||
        line[field].length > 200 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(line[field])
      )
        fail(`${field} must contain 1–200 characters.`);
    try {
      dayNumber(line.date);
    } catch {
      fail("date must be a valid YYYY-MM-DD calendar date.");
    }
    if (!["paid", "pending", "cancelled"].includes(line.status))
      fail("status must be paid, pending or cancelled.");
    if (
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 10000
    )
      fail("quantity must be a whole number from 1 to 10,000.");
    for (const field of ["unitPrice", "discount", "refund"] as const)
      if (
        !Number.isSafeInteger(line[field]) ||
        line[field] < 0 ||
        line[field] > 99999999999
      )
        fail(`${field} must be a valid non-negative amount.`);
    const gross = line.quantity * line.unitPrice;
    if (!Number.isSafeInteger(gross)) fail("The line amount is too large.");
    totalGross += gross;
    if (!Number.isSafeInteger(totalGross))
      fail("The dataset total exceeds the safe integer reporting limit.");
    if (line.discount > gross)
      fail("The line discount exceeds its gross sales.");
    if (line.refund > gross - line.discount)
      fail("The line refund exceeds sales after discounts.");
    if (line.status !== "paid" && line.refund > 0)
      fail("Only paid order lines can carry a refund.");
    if (!/^[A-Z]{3}$/.test(line.currency))
      fail("currency must be a three-letter uppercase code.");
    if (ids.has(line.lineId))
      fail("A line ID is duplicated. Nothing was imported.");
    ids.add(line.lineId);
    currencies.add(line.currency);
    const context = JSON.stringify([
      line.date,
      line.channel,
      line.status,
      line.currency,
    ]);
    if (orders.has(line.orderId) && orders.get(line.orderId) !== context)
      fail(
        "Lines in the same order disagree on date, channel, status or currency.",
      );
    orders.set(line.orderId, context);
    const productContext = JSON.stringify([line.product, line.category]);
    if (products.has(line.sku) && products.get(line.sku) !== productContext)
      fail("A SKU has conflicting product names or categories.");
    products.set(line.sku, productContext);
  }
  if (currencies.size !== 1)
    throw new Error(
      "Import one currency at a time. This dashboard does not convert currencies.",
    );
  if (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: lines[0]!.currency,
    }).resolvedOptions().maximumFractionDigits !== 2
  )
    throw new Error(
      "Use a currency with two decimal minor units, such as AUD, USD or EUR.",
    );
  if (
    new Set(lines.map((l) => l.category)).size > 100 ||
    new Set(lines.map((l) => l.channel)).size > 50
  )
    throw new Error("Use at most 100 categories and 50 channels per file.");
}
export function datasetFromLines(
  lines: OrderLine[],
  source: Dataset["source"] = "import",
  ignoredColumns: string[] = [],
): Dataset {
  validateLines(lines);
  const dates = lines.map((l) => l.date).sort();
  return {
    lines,
    source,
    coverage: { start: dates[0]!, end: dates[dates.length - 1]! },
    ignoredColumns,
  };
}
