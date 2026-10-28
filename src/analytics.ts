import {
  dayNumber,
  shiftDate,
  decimal,
  type Dataset,
  type OrderLine,
  type Selection,
} from "./model.js";
import { writeCSV } from "./csv.js";
export type Totals = {
  gross: number;
  discounts: number;
  refunds: number;
  net: number;
  orders: number;
  units: number;
  aov: number | null;
  refundRate: number | null;
};
export type Product = {
  sku: string;
  name: string;
  category: string;
  units: number;
  orders: number;
  net: number;
  refunds: number;
  share: number | null;
};
export type Report = {
  selection: Selection;
  currency: string;
  current: Totals;
  previous: Totals | null;
  comparison: { start: string; end: string; available: boolean };
  daily: { date: string; net: number; orders: number }[];
  products: Product[];
  categories: { name: string; net: number; orders: number }[];
  excludedLines: number;
};
function summarize(lines: OrderLine[]): Totals {
  const ids = new Set(lines.map((l) => l.orderId));
  let gross = 0,
    discounts = 0,
    refunds = 0,
    units = 0;
  for (const l of lines) {
    gross += l.quantity * l.unitPrice;
    discounts += l.discount;
    refunds += l.refund;
    units += l.quantity;
  }
  const net = gross - discounts - refunds;
  if (![gross, discounts, refunds, net].every(Number.isSafeInteger))
    throw new Error("The report is too large to calculate safely.");
  return {
    gross,
    discounts,
    refunds,
    net,
    orders: ids.size,
    units,
    aov: ids.size ? net / ids.size : null,
    refundRate: gross - discounts > 0 ? refunds / (gross - discounts) : null,
  };
}
export function percentChange(
  current: number,
  previous: number | null,
): number | null {
  return previous === null || previous === 0
    ? null
    : (current - previous) / Math.abs(previous);
}
export function defaultSelection(dataset: Dataset, days = 30): Selection {
  return {
    start: shiftDate(dataset.coverage.end, -days + 1),
    end: dataset.coverage.end,
    channel: "all",
    category: "all",
  };
}
export function buildReport(dataset: Dataset, selection: Selection): Report {
  const start = dayNumber(selection.start),
    end = dayNumber(selection.end),
    length = end - start + 1;
  if (length < 1 || length > 366)
    throw new Error("Choose a date range between 1 and 366 days.");
  const previousStart = shiftDate(selection.start, -length),
    previousEnd = shiftDate(selection.start, -1);
  const available =
    previousStart >= dataset.coverage.start &&
    previousEnd <= dataset.coverage.end;
  const matching = dataset.lines.filter(
    (l) =>
      (selection.channel === "all" || l.channel === selection.channel) &&
      (selection.category === "all" || l.category === selection.category),
  );
  const active = matching.filter((l) => l.status === "paid");
  const current = active.filter(
    (l) => l.date >= selection.start && l.date <= selection.end,
  );
  const previous = active.filter(
    (l) => l.date >= previousStart && l.date <= previousEnd,
  );
  const productGroups = new Map<string, OrderLine[]>();
  const categoryGroups = new Map<string, OrderLine[]>();
  const dailyMap = new Map<string, OrderLine[]>();
  for (const line of current) {
    const product = productGroups.get(line.sku) ?? [];
    product.push(line);
    productGroups.set(line.sku, product);
    const category = categoryGroups.get(line.category) ?? [];
    category.push(line);
    categoryGroups.set(line.category, category);
    const day = dailyMap.get(line.date) ?? [];
    day.push(line);
    dailyMap.set(line.date, day);
  }
  const totals = summarize(current);
  return {
    selection,
    currency: dataset.lines[0]!.currency,
    current: totals,
    previous: available ? summarize(previous) : null,
    comparison: { start: previousStart, end: previousEnd, available },
    daily: Array.from({ length }, (_, i) => {
      const date = shiftDate(selection.start, i),
        t = summarize(dailyMap.get(date) ?? []);
      return { date, net: t.net, orders: t.orders };
    }),
    products: [...productGroups]
      .map(([sku, lines]) => {
        const t = summarize(lines);
        return {
          sku,
          name: lines[0]!.product,
          category: lines[0]!.category,
          units: t.units,
          orders: t.orders,
          net: t.net,
          refunds: t.refunds,
          share: totals.net > 0 ? t.net / totals.net : null,
        };
      })
      .sort((a, b) => b.net - a.net || a.sku.localeCompare(b.sku)),
    categories: [...categoryGroups]
      .map(([name, lines]) => {
        const t = summarize(lines);
        return { name, net: t.net, orders: t.orders };
      })
      .sort((a, b) => b.net - a.net || a.name.localeCompare(b.name)),
    excludedLines: matching.filter(
      (l) =>
        l.status !== "paid" &&
        l.date >= selection.start &&
        l.date <= selection.end,
    ).length,
  };
}
export function exportReport(
  report: Report,
  products = report.products,
): string {
  return writeCSV([
    [
      "period_start",
      "period_end",
      "channel_filter",
      "category_filter",
      "currency",
      "sku",
      "product",
      "category",
      "units_ordered",
      "orders_containing_product",
      "net_product_sales",
      "refunded_sales",
    ],
    ...products.map((p) => [
      report.selection.start,
      report.selection.end,
      report.selection.channel,
      report.selection.category,
      report.currency,
      p.sku,
      p.name,
      p.category,
      p.units,
      p.orders,
      decimal(p.net),
      decimal(p.refunds),
    ]),
  ]);
}
