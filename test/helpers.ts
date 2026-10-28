import { datasetFromLines, type OrderLine } from "../src/model.js";
export const line = (patch: Partial<OrderLine> = {}): OrderLine => ({
  lineId: "L-1",
  orderId: "O-1",
  date: "2026-10-20",
  sku: "PACK",
  product: "Trail Pack",
  category: "Packs",
  channel: "Online store",
  status: "paid",
  quantity: 2,
  unitPrice: 10000,
  discount: 2000,
  refund: 3000,
  currency: "AUD",
  ...patch,
});
export const dataset = (lines: OrderLine[] = [line()]) =>
  datasetFromLines(lines);
