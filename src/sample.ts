import {
  datasetFromLines,
  shiftDate,
  type Dataset,
  type OrderLine,
} from "./model.js";
export const CATALOG = [
  {
    sku: "PACK-28",
    name: "Ridge 28L Daypack",
    category: "Packs & bags",
    price: 12900,
    icon: "pack",
  },
  {
    sku: "TENT-2P",
    name: "Alpine 2P Tent",
    category: "Shelter",
    price: 27900,
    icon: "tent",
  },
  {
    sku: "SOCK-MR",
    name: "Merino Trail Socks",
    category: "Trail accessories",
    price: 2400,
    icon: "trail",
  },
  {
    sku: "FLASK-50",
    name: "Insulated Trail Flask",
    category: "Camp essentials",
    price: 3900,
    icon: "flask",
  },
  {
    sku: "POLE-AL",
    name: "Aluminium Trekking Poles",
    category: "Trail accessories",
    price: 8900,
    icon: "trail",
  },
  {
    sku: "LIGHT-01",
    name: "Rechargeable Camp Lantern",
    category: "Camp essentials",
    price: 4900,
    icon: "lantern",
  },
  {
    sku: "COVER-28",
    name: "Daypack Rain Cover",
    category: "Packs & bags",
    price: 1900,
    icon: "pack",
  },
  {
    sku: "GAITER-01",
    name: "All-weather Trail Gaiters",
    category: "Trail accessories",
    price: 4500,
    icon: "trail",
  },
] as const;
export function createSampleDataset(): Dataset {
  let seed = 87321;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const lines: OrderLine[] = [];
  let order = 2000;
  let line = 0;
  for (let day = 0; day < 90; day++) {
    const date = shiftDate("2026-07-31", day);
    const orders = 3 + Math.floor(random() * 3) + (day > 60 ? 2 : 0);
    for (let n = 0; n < orders; n++) {
      order++;
      const channel = ["Online store", "Marketplace", "Retail shop"][
        Math.floor(random() * 3)
      ]!;
      const status =
        random() < 0.025 ? "cancelled" : random() < 0.025 ? "pending" : "paid";
      const basket = random() < 0.42 ? 2 : 1;
      for (let item = 0; item < basket; item++) {
        const product = CATALOG[Math.floor(random() * CATALOG.length)]!;
        const quantity = random() < 0.18 ? 2 : 1;
        const gross = product.price * quantity;
        const discount = random() < 0.16 ? Math.floor(gross / 10) : 0;
        const refund =
          status === "paid" && random() < 0.045
            ? Math.floor((gross - discount) * (random() < 0.6 ? 1 : 0.5))
            : 0;
        lines.push({
          lineId: `L-${++line}`,
          orderId: `SP-${order}`,
          date,
          sku: product.sku,
          product: product.name,
          category: product.category,
          channel,
          status,
          quantity,
          unitPrice: product.price,
          discount,
          refund,
          currency: "AUD",
        });
      }
    }
  }
  return datasetFromLines(lines, "sample");
}
