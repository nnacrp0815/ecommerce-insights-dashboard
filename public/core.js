// Generated from the shared TypeScript modules by npm run build.
window.RetailInsights = (() => {
  const DAY = 86400000;
  function dayNumber(value) {
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
  function shiftDate(value, days) {
    if (!Number.isSafeInteger(days))
      throw new Error("Date offsets must be whole days.");
    return new Date((dayNumber(value) + days) * DAY).toISOString().slice(0, 10);
  }
  function cents(value) {
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(value))
      throw new Error(
        "Money must be a non-negative decimal with at most two decimal places, without a currency symbol.",
      );
    const [whole, part = ""] = value.split(".");
    return Number(whole) * 100 + Number(part.padEnd(2, "0"));
  }
  function decimal(value) {
    if (!Number.isSafeInteger(value))
      throw new Error("Money must be stored as integer cents.");
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  }
  function validateLines(lines) {
    if (!lines.length || lines.length > 50000)
      throw new Error("Use a file with between 1 and 50,000 order lines.");
    const ids = new Set();
    const orders = new Map();
    const currencies = new Set();
    const products = new Map();
    let totalGross = 0;
    for (const [index, line] of lines.entries()) {
      const row = `Row ${index + 2}: `;
      const fail = (message) => {
        throw new Error(row + message);
      };
      for (const field of [
        "lineId",
        "orderId",
        "sku",
        "product",
        "category",
        "channel",
      ])
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
      for (const field of ["unitPrice", "discount", "refund"])
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
        currency: lines[0].currency,
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
  function datasetFromLines(lines, source = "import", ignoredColumns = []) {
    validateLines(lines);
    const dates = lines.map((l) => l.date).sort();
    return {
      lines,
      source,
      coverage: { start: dates[0], end: dates[dates.length - 1] },
      ignoredColumns,
    };
  }

  const HEADERS = [
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
  ];
  /** Strict quoted CSV parser supporting BOM, embedded commas/newlines and CRLF. */
  function parseCSV(text) {
    if (new TextEncoder().encode(text).byteLength > 5 * 1024 * 1024)
      throw new Error(
        "The CSV limit is 5 MB. Split larger files before importing.",
      );
    if (text.startsWith("\ufeff")) text = text.slice(1);
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    let closed = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
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
    while (rows.length && rows[rows.length - 1].every((v) => !v.trim()))
      rows.pop();
    return rows;
  }
  function importCSV(text) {
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
    const lines = rows.map((fields, index) => {
      if (fields.length !== header.length)
        throw new Error(
          `Row ${index + 2}: column count does not match the header.`,
        );
      const get = (name) => fields[indexes.get(name)].trim();
      const quantity = get("quantity");
      if (!/^\d+$/.test(quantity))
        throw new Error(
          `Row ${index + 2}: quantity must be a positive whole number.`,
        );
      const amount = (name) => {
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
        status: get("status"),
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
      header.filter((h) => !HEADERS.includes(h)),
    );
  }
  /** Spreadsheet formula prefixes are escaped on string exports, before RFC-style quoting. */
  function csvCell(value) {
    let text = String(value);
    if (typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(text))
      text = "'" + text;
    return /[",\r\n]/.test(text)
      ? '"' + text.replaceAll('"', '""') + '"'
      : text;
  }
  function writeCSV(rows) {
    return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }
  function exportOrders(lines) {
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

  function summarize(lines) {
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
  function percentChange(current, previous) {
    return previous === null || previous === 0
      ? null
      : (current - previous) / Math.abs(previous);
  }
  function defaultSelection(dataset, days = 30) {
    return {
      start: shiftDate(dataset.coverage.end, -days + 1),
      end: dataset.coverage.end,
      channel: "all",
      category: "all",
    };
  }
  function buildReport(dataset, selection) {
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
    const productGroups = new Map();
    const categoryGroups = new Map();
    const dailyMap = new Map();
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
      currency: dataset.lines[0].currency,
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
            name: lines[0].product,
            category: lines[0].category,
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
  function exportReport(report, products = report.products) {
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

  const CATALOG = [
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
  ];
  function createSampleDataset() {
    let seed = 87321;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const lines = [];
    let order = 2000;
    let line = 0;
    for (let day = 0; day < 90; day++) {
      const date = shiftDate("2026-07-31", day);
      const orders = 3 + Math.floor(random() * 3) + (day > 60 ? 2 : 0);
      for (let n = 0; n < orders; n++) {
        order++;
        const channel = ["Online store", "Marketplace", "Retail shop"][
          Math.floor(random() * 3)
        ];
        const status =
          random() < 0.025
            ? "cancelled"
            : random() < 0.025
              ? "pending"
              : "paid";
        const basket = random() < 0.42 ? 2 : 1;
        for (let item = 0; item < basket; item++) {
          const product = CATALOG[Math.floor(random() * CATALOG.length)];
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

  return {
    importCSV,
    exportOrders,
    buildReport,
    defaultSelection,
    percentChange,
    exportReport,
    createSampleDataset,
    CATALOG,
    shiftDate,
    dayNumber,
  };
})();
