const api = window.RetailInsights;
const $ = (selector) => document.querySelector(selector);
const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const svgNode = (tag, attrs = {}, text) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
};
const icon = (name) => {
  const svg = svgNode("svg", { "aria-hidden": "true" });
  svg.append(svgNode("use", { href: `#i-${name}` }));
  return svg;
};
const colors = ["#4d876c", "#a6b791", "#d0af81", "#9eafb7", "#c9c4a7"];
let dataset = api.createSampleDataset();
let selection = api.defaultSelection(dataset);
let report;
let sourceName = "";
let page = 0;
let importGeneration = 0;
let toastTimer;
let chartGeometry;
const money = (amount, options = {}) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: report?.currency || dataset.lines[0].currency,
    ...options,
  }).format(amount / 100);
const count = (value) => new Intl.NumberFormat("en-AU").format(value);
const percent = (value, digits = 1) =>
  new Intl.NumberFormat("en-AU", {
    style: "percent",
    maximumFractionDigits: digits,
  }).format(value);
const shortDate = (value) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
function toast(text) {
  clearTimeout(toastTimer);
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 5500);
}
function setupFilters() {
  for (const [id, key, label] of [
    ["channel", "channel", "All channels"],
    ["category", "category", "All categories"],
  ]) {
    const select = $(`#${id}`);
    select.replaceChildren(new Option(label, "all"));
    for (const value of [...new Set(dataset.lines.map((l) => l[key]))].sort())
      select.append(new Option(value, value));
    select.value = "all";
  }
  $("#start").value = selection.start;
  $("#end").value = selection.end;
}
function deltaBadge(current, previous, lowerIsBetter = false) {
  const change = api.percentChange(current, previous);
  if (change === null)
    return make(
      "span",
      previous === 0 ? "Zero baseline" : "No comparison",
      "delta neutral",
    );
  const good = lowerIsBetter ? change <= 0 : change >= 0;
  return make(
    "span",
    `${change > 0 ? "↗" : change < 0 ? "↘" : "→"} ${percent(Math.abs(change))}`,
    `delta${good ? "" : " negative"}`,
  );
}
function renderStats() {
  const target = $("#stats");
  target.replaceChildren();
  const current = report.current,
    previous = report.previous;
  const stats = [
    {
      label: "Net product sales",
      value: money(current.net),
      raw: current.net,
      prior: previous?.net ?? null,
      icon: "money",
    },
    {
      label: "Paid orders",
      value: count(current.orders),
      raw: current.orders,
      prior: previous?.orders ?? null,
      icon: "box",
    },
    {
      label: "Average order value",
      value: current.aov === null ? "—" : money(current.aov),
      raw: current.aov,
      prior: previous?.aov ?? null,
      icon: "chart",
    },
    {
      label: "Refunded sales",
      value: money(current.refunds),
      raw: current.refunds,
      prior: previous?.refunds ?? null,
      icon: "return",
      lower: true,
    },
  ];
  for (const stat of stats) {
    const card = make("div", undefined, "stat-card"),
      top = make("div", undefined, "stat-top"),
      mark = make("span", undefined, "stat-icon");
    mark.append(icon(stat.icon));
    top.append(make("span", stat.label), mark);
    const bottom = make("div", undefined, "stat-bottom");
    bottom.append(
      deltaBadge(
        stat.raw ?? 0,
        stat.raw === null ? null : stat.prior,
        stat.lower,
      ),
      make(
        "small",
        report.previous ? "vs previous period" : "Earlier period unavailable",
      ),
    );
    card.append(top, make("strong", stat.value), bottom);
    target.append(card);
  }
}
function drawTrend() {
  const container = $("#trend-chart");
  container.replaceChildren();
  const width = Math.max(
      320,
      Math.floor(container.getBoundingClientRect().width) - 32,
    ),
    height = 245;
  const left = 55,
    right = 15,
    top = 25,
    bottom = 35,
    plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const peak = Math.max(100, ...report.daily.map((d) => d.net));
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const maximum =
    [1, 2, 4, 5, 10].find((step) => step * magnitude >= peak) * magnitude;
  const x = (index) =>
    left +
    (report.daily.length === 1
      ? plotWidth / 2
      : (index / (report.daily.length - 1)) * plotWidth);
  const y = (value) => top + plotHeight * (1 - value / maximum);
  const svg = svgNode("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": `Daily net product sales from ${selection.start} to ${selection.end}. Use the Inspect a day slider for exact amounts.`,
  });
  const defs = svgNode("defs"),
    gradient = svgNode("linearGradient", {
      id: "sales-area",
      x1: "0",
      x2: "0",
      y1: "0",
      y2: "1",
    });
  gradient.append(
    svgNode("stop", {
      offset: "0%",
      "stop-color": "#a6c5ab",
      "stop-opacity": ".32",
    }),
    svgNode("stop", {
      offset: "100%",
      "stop-color": "#d5e5d4",
      "stop-opacity": ".03",
    }),
  );
  defs.append(gradient);
  svg.append(defs);
  for (let tick = 0; tick <= 4; tick++) {
    const value = (maximum * tick) / 4,
      yy = y(value);
    svg.append(
      svgNode("line", {
        x1: left,
        y1: yy,
        x2: width - right,
        y2: yy,
        stroke: "#edf1eb",
        "stroke-width": 1,
        "stroke-dasharray": tick ? "3 4" : "0",
      }),
      svgNode(
        "text",
        {
          x: left - 11,
          y: yy + 3.5,
          "text-anchor": "end",
          fill: "#7c8b7c",
          stroke: "none",
          "font-size": 9,
        },
        money(value, { maximumFractionDigits: 2, notation: "compact" }),
      ),
    );
  }
  const points = report.daily.map((d, i) => [x(i), y(d.net)]);
  const path = points
    .map(([xx, yy], i) => `${i ? "L" : "M"} ${xx} ${yy}`)
    .join(" ");
  svg.append(
    svgNode("path", {
      d: `${path} L ${x(report.daily.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`,
      fill: "url(#sales-area)",
      stroke: "none",
    }),
    svgNode("path", {
      d: path,
      fill: "none",
      stroke: "#438267",
      "stroke-width": 2.2,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }),
  );
  const tickIndexes = [
    ...new Set([
      0,
      Math.floor((report.daily.length - 1) / 3),
      Math.floor(((report.daily.length - 1) * 2) / 3),
      report.daily.length - 1,
    ]),
  ];
  for (const index of tickIndexes)
    svg.append(
      svgNode(
        "text",
        {
          x: x(index),
          y: height - 10,
          "text-anchor":
            index === 0
              ? "start"
              : index === report.daily.length - 1
                ? "end"
                : "middle",
          fill: "#7c8b7c",
          stroke: "none",
          "font-size": 9,
        },
        shortDate(report.daily[index].date),
      ),
    );
  const guide = svgNode("line", {
      stroke: "#8eb298",
      "stroke-width": 1,
      "stroke-dasharray": "3 4",
      y1: top,
      y2: y(0),
    }),
    point = svgNode("circle", {
      r: 4.5,
      fill: "#4d876c",
      stroke: "#fff",
      "stroke-width": 2.5,
    });
  svg.append(guide, point);
  container.append(svg);
  chartGeometry = { points, guide, point };
  const slider = $("#chart-cursor");
  slider.max = String(report.daily.length - 1);
  slider.value = slider.max;
  inspectDay();
}
function inspectDay() {
  const index = Math.min(
      Number($("#chart-cursor").value),
      report.daily.length - 1,
    ),
    day = report.daily[index];
  const [x, y] = chartGeometry.points[index];
  chartGeometry.guide.setAttribute("x1", String(x));
  chartGeometry.guide.setAttribute("x2", String(x));
  chartGeometry.point.setAttribute("cx", String(x));
  chartGeometry.point.setAttribute("cy", String(y));
  $("#day-value").textContent = `${shortDate(day.date)} · ${money(day.net)}`;
  $("#chart-cursor").setAttribute(
    "aria-valuetext",
    `${shortDate(day.date)}: ${money(day.net)}, ${day.orders} paid orders`,
  );
}
function drawCategories() {
  const target = $("#category-chart"),
    legend = $("#category-legend");
  target.replaceChildren();
  legend.replaceChildren();
  if (!report.current.net) {
    target.append(make("p", "No sales in this view", "legend-empty"));
    return;
  }
  const groups = report.categories.slice(0, 4);
  if (report.categories.length > 4)
    groups.push({
      name: "Other categories",
      net: report.categories.slice(4).reduce((n, c) => n + c.net, 0),
    });
  const svg = svgNode("svg", {
    viewBox: "0 0 180 180",
    role: "img",
    "aria-label":
      "Net sales by category. Category amounts and rounded shares are listed beside the chart.",
  });
  const radius = 62,
    circumference = 2 * Math.PI * radius;
  let offset = 0;
  svg.append(
    svgNode("circle", {
      cx: 90,
      cy: 90,
      r: radius,
      fill: "none",
      stroke: "#f0f4ed",
      "stroke-width": 20,
    }),
  );
  for (const [i, group] of groups.entries()) {
    const share = group.net / report.current.net,
      length = share * circumference;
    svg.append(
      svgNode("circle", {
        cx: 90,
        cy: 90,
        r: radius,
        fill: "none",
        stroke: colors[i],
        "stroke-width": 20,
        "stroke-dasharray": `${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`,
        "stroke-dashoffset": -offset,
        transform: "rotate(-90 90 90)",
      }),
    );
    offset += length;
    const row = make("div", undefined, "legend-row"),
      dot = svgNode("svg", {
        viewBox: "0 0 8 8",
        width: 8,
        height: 8,
        "aria-hidden": "true",
      });
    dot.append(
      svgNode("rect", {
        width: 8,
        height: 8,
        rx: 2,
        fill: colors[i],
        stroke: "none",
      }),
    );
    row.append(
      dot,
      make("span", group.name),
      make("strong", money(group.net)),
      make("small", percent(share, 0)),
    );
    legend.append(row);
  }
  svg.append(
    svgNode(
      "text",
      {
        x: 90,
        y: 85,
        "text-anchor": "middle",
        fill: "#7f8b7c",
        stroke: "none",
        "font-size": 10,
      },
      "NET SALES",
    ),
    svgNode(
      "text",
      {
        x: 90,
        y: 109,
        "text-anchor": "middle",
        fill: "#355e46",
        stroke: "none",
        "font-size": 21,
        "font-weight": 550,
        "letter-spacing": -0.8,
      },
      money(report.current.net, {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    ),
  );
  target.append(svg);
}
function tableProducts() {
  const query = $("#product-search").value.trim().toLowerCase();
  const sort = $("#sort").value;
  return report.products
    .filter((p) =>
      `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query),
    )
    .sort((a, b) => b[sort] - a[sort] || a.sku.localeCompare(b.sku));
}
function renderProducts() {
  const products = tableProducts(),
    rows = $("#product-rows");
  rows.replaceChildren();
  page = Math.min(page, Math.max(0, Math.ceil(products.length / 50) - 1));
  for (const product of products.slice(page * 50, page * 50 + 50)) {
    const row = make("tr"),
      cell = make("td"),
      name = make("span", undefined, "product-name"),
      kind = api.CATALOG.find((p) => p.sku === product.sku)?.icon ?? "box",
      mark = make("span", undefined, `product-mark ${kind}`),
      copy = make("span");
    mark.append(icon(kind));
    copy.append(
      make("strong", product.name),
      make("small", `${product.sku} · ${product.category}`),
    );
    name.append(mark, copy);
    cell.append(name);
    row.append(
      cell,
      make("td", count(product.units)),
      make("td", count(product.orders)),
      make("td", money(product.net), "money-cell"),
      make("td", money(product.refunds), "refund-cell"),
    );
    const share = make("td"),
      shareWrap = make("div", undefined, "share-cell"),
      bar = svgNode("svg", {
        viewBox: "0 0 46 4",
        width: 46,
        height: 4,
        "aria-hidden": "true",
      });
    bar.append(
      svgNode("rect", {
        x: 0,
        y: 0,
        width: 46,
        height: 4,
        rx: 2,
        fill: "#edf2e9",
        stroke: "none",
      }),
      svgNode("rect", {
        x: 0,
        y: 0,
        width: 46 * (product.share ?? 0),
        height: 4,
        rx: 2,
        fill: "#8daa79",
        stroke: "none",
      }),
    );
    shareWrap.append(
      bar,
      make("span", product.share === null ? "—" : percent(product.share, 0)),
    );
    share.append(shareWrap);
    row.append(share);
    rows.append(row);
  }
  if (!products.length) {
    const row = make("tr"),
      cell = make(
        "td",
        report.products.length
          ? "No products match your search. Try a name or SKU."
          : "No paid product sales match these filters.",
        "empty-row",
      );
    cell.colSpan = 6;
    row.append(cell);
    rows.append(row);
  }
  $("#product-count").textContent = String(report.products.length);
  $("#table-summary").textContent = products.length
    ? `Showing ${page * 50 + 1}–${Math.min(products.length, page * 50 + 50)} of ${products.length} products`
    : "No products in this view";
  $("#previous-page").disabled = page === 0;
  $("#next-page").disabled = (page + 1) * 50 >= products.length;
  $(".pagination").hidden = products.length <= 50;
  $("#export").disabled = products.length === 0;
}
function renderInsight() {
  const top = report.products[0];
  if (!top) {
    $("#insight-title").textContent =
      "A quiet window is still useful information.";
    $("#insight-copy").textContent =
      "There are no paid product sales for this selection. Try another period, channel or category.";
    return;
  }
  $("#insight-title").textContent = `${top.name} leads this view.`;
  $("#insight-copy").textContent =
    `It contributes ${money(top.net)}${top.share === null ? "" : ` (${percent(top.share, 0)})`} of filtered net sales. ${report.excludedLines ? `${report.excludedLines} pending or cancelled line(s) are excluded.` : "Only paid order lines are included."}`;
}
function renderReport() {
  try {
    report = api.buildReport(dataset, selection);
    $("#report-error").hidden = true;
  } catch (error) {
    if (report) selection = { ...report.selection };
    $("#report-error").textContent = error.message;
    $("#report-error").hidden = false;
    return;
  }
  $("#date-caption").textContent =
    `${shortDate(selection.start)} – ${shortDate(selection.end)} ${selection.end.slice(0, 4)}`;
  $("#table-context").textContent = report.currency + " · Current filters";
  const outside =
    selection.start < dataset.coverage.start ||
    selection.end > dataset.coverage.end;
  $("#coverage-note").hidden = !outside;
  $("#coverage-note").textContent =
    `This window extends beyond the file’s observed dates (${dataset.coverage.start} to ${dataset.coverage.end}). Only supplied rows are counted; unavailable days are shown as zero.`;
  $("#source-badge").replaceChildren(
    make("span"),
    make(
      "span",
      dataset.source === "sample"
        ? "Fictional sample data"
        : "Imported CSV · local only",
    ),
  );
  $("#source-title").textContent =
    dataset.source === "sample"
      ? "A little insight for your next adventure."
      : "Your imported data, in focus.";
  $("#source-description").textContent =
    dataset.source === "sample"
      ? "Explore a fictional outdoor retailer: daypacks, tents, trail accessories and camp essentials."
      : `${sourceName} · ${count(dataset.lines.length)} validated lines · Observed dates ${dataset.coverage.start} to ${dataset.coverage.end}.`;
  $("#restore").hidden = dataset.source === "sample";
  page = 0;
  renderStats();
  drawTrend();
  drawCategories();
  renderProducts();
  renderInsight();
}
function download(name, text) {
  const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    ),
    anchor = make("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("#period").addEventListener("change", () => {
  const value = $("#period").value;
  $("#custom-dates").hidden = value !== "custom";
  if (value !== "custom") {
    selection = {
      ...selection,
      ...api.defaultSelection(dataset, Number(value)),
      channel: selection.channel,
      category: selection.category,
    };
    $("#start").value = selection.start;
    $("#end").value = selection.end;
    renderReport();
  }
});
$("#custom-dates").addEventListener("submit", (event) => {
  event.preventDefault();
  selection = { ...selection, start: $("#start").value, end: $("#end").value };
  renderReport();
});
for (const id of ["channel", "category"])
  $(`#${id}`).addEventListener("change", () => {
    selection = { ...selection, [id]: $(`#${id}`).value };
    renderReport();
  });
$("#chart-cursor").addEventListener("input", inspectDay);
$("#product-search").addEventListener("input", () => {
  page = 0;
  renderProducts();
});
$("#sort").addEventListener("change", () => {
  page = 0;
  renderProducts();
});
$("#previous-page").addEventListener("click", () => {
  page--;
  renderProducts();
});
$("#next-page").addEventListener("click", () => {
  page++;
  renderProducts();
});
$("#export").addEventListener("click", () => {
  download(
    `product-report-${selection.start}-to-${selection.end}.csv`,
    api.exportReport(report, tableProducts()),
  );
  toast("Product report exported with the current filters.");
});
$("#download-template").addEventListener("click", () =>
  download(
    "summit-pine-sample-orders.csv",
    api.exportOrders(api.createSampleDataset().lines),
  ),
);
$("#csv-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const generation = ++importGeneration;
  event.target.disabled = true;
  $("#import-error").hidden = true;
  try {
    if (file.size > 5 * 1024 * 1024)
      throw new Error(
        "The CSV limit is 5 MB. Split larger files before importing.",
      );
    const next = api.importCSV(await file.text());
    const nextSelection = api.defaultSelection(next);
    api.buildReport(next, nextSelection);
    if (generation !== importGeneration) return;
    dataset = next;
    sourceName = file.name;
    selection = nextSelection;
    $("#period").value = "30";
    $("#custom-dates").hidden = true;
    $("#product-search").value = "";
    setupFilters();
    renderReport();
    $("#import-dialog").close();
    toast(
      `Imported ${count(dataset.lines.length)} validated lines. ${dataset.ignoredColumns.length ? "Unrelated columns were ignored." : "Your file stays on this device."}`,
    );
  } catch (error) {
    $("#import-error").textContent = error.message;
    $("#import-error").hidden = false;
  } finally {
    event.target.value = "";
    event.target.disabled = false;
  }
});
$("#restore").addEventListener("click", () => {
  importGeneration++;
  dataset = api.createSampleDataset();
  selection = api.defaultSelection(dataset);
  sourceName = "";
  $("#period").value = "30";
  $("#custom-dates").hidden = true;
  $("#product-search").value = "";
  setupFilters();
  renderReport();
  toast("Fictional sample data restored.");
});
document.querySelectorAll("[data-dialog]").forEach((button) =>
  button.addEventListener("click", () => {
    if (button.dataset.dialog === "import") $("#import-error").hidden = true;
    $(`#${button.dataset.dialog}-dialog`).showModal();
  }),
);
document
  .querySelectorAll(".close-dialog")
  .forEach((button) =>
    button.addEventListener("click", () => button.closest("dialog").close()),
  );
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawTrend, 120);
});
setupFilters();
renderReport();
