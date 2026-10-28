import {
  cents,
  datasetFromLines,
  decimal,
  type Dataset,
  type OrderLine,
  type Status,
} from "./model.js";
export const HEADERS = [
  "line_id",
  "order_id",
  "date",
  "sku",
  "product",
  "category",
  "channel",
  "status",
  "quantity",
  "unit_price",
  "discount",
  "refund",
  "currency",
] as const;

/** Strict quoted CSV parser supporting BOM, embedded commas/newlines and CRLF. */
export function parseCSV(text: string): string[][] {
  if (new TextEncoder().encode(text).byteLength > 5 * 1024 * 1024)
    throw new Error(
      "The CSV limit is 5 MB. Split larger files before importing.",
    );
  if (text.startsWith("\ufeff")) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += ch;
      continue;
    }
    if (closed && ![",", "\r", "\n"].includes(ch))
      throw new Error("Unexpected text after a closing quote.");
    if (ch === '"') {
      if (field || closed)
        throw new Error("A quote appears inside an unquoted field.");
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      closed = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      closed = false;
      if (rows.length > 50001)
        throw new Error("The file contains more than 50,000 order lines.");
    } else field += ch;
  }
  if (quoted) throw new Error("A quoted field was not closed.");
  if (field || row.length || closed) {
    row.push(field);
    rows.push(row);
  }
  while (rows.length && rows[rows.length - 1]!.every((v) => !v.trim()))
    rows.pop();
  return rows;
}
export function importCSV(text: string): Dataset {
  const rows = parseCSV(text);
  const header = rows.shift()?.map((h) => h.trim().toLowerCase());
  if (!header?.length)
    throw new Error("The file is empty. Use the sample CSV as a template.");
  if (new Set(header).size !== header.length)
    throw new Error("Column headings must be unique.");
  const missing = HEADERS.filter((h) => !header.includes(h));
  if (missing.length)
    throw new Error(
      `Missing columns: ${missing.join(", ")}. Download the sample template.`,
    );
  const indexes = new Map(header.map((name, index) => [name, index]));
  const lines = rows.map((fields, index): OrderLine => {
    if (fields.length !== header.length)
      throw new Error(
        `Row ${index + 2}: column count does not match the header.`,
      );
    const get = (name: (typeof HEADERS)[number]) =>
      fields[indexes.get(name)!]!.trim();
    const quantity = get("quantity");
    if (!/^\d+$/.test(quantity))
      throw new Error(
        `Row ${index + 2}: quantity must be a positive whole number.`,
      );
    const amount = (name: "unit_price" | "discount" | "refund") => {
      try {
        return cents(get(name));
      } catch {
        throw new Error(
          `Row ${index + 2}: ${name} must be a decimal amount with at most two decimal places.`,
        );
      }
    };
    return {
      lineId: get("line_id"),
      orderId: get("order_id"),
      date: get("date"),
      sku: get("sku"),
      product: get("product"),
      category: get("category"),
      channel: get("channel"),
      status: get("status") as Status,
      quantity: Number(quantity),
      unitPrice: amount("unit_price"),
      discount: amount("discount"),
      refund: amount("refund"),
      currency: get("currency"),
    };
  });
  return datasetFromLines(
    lines,
    "import",
    header.filter((h) => !HEADERS.includes(h as (typeof HEADERS)[number])),
  );
}
/** Spreadsheet formula prefixes are escaped on string exports, before RFC-style quoting. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(text))
    text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
export function writeCSV(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
export function exportOrders(lines: OrderLine[]): string {
  return writeCSV([
    [...HEADERS],
    ...lines.map((l) => [
      l.lineId,
      l.orderId,
      l.date,
      l.sku,
      l.product,
      l.category,
      l.channel,
      l.status,
      l.quantity,
      decimal(l.unitPrice),
      decimal(l.discount),
      decimal(l.refund),
      l.currency,
    ]),
  ]);
}
