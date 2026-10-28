import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import prettier from "prettier";
import { createSampleDataset } from "../dist/src/sample.js";
import { exportOrders } from "../dist/src/csv.js";

// The browser and CLI run the same compiled model; only local module wrappers are removed.
const modules = ["model", "csv", "analytics", "sample"];
const source = modules
  .map((name) =>
    readFileSync(`dist/src/${name}.js`, "utf8")
      .replace(/^import [\s\S]*?;\r?\n/gm, "")
      .replace(/^export /gm, ""),
  )
  .join("\n");
if (/^\s*(import|export)\s/m.test(source))
  throw new Error("The browser core must remain self-contained.");
const bundle = await prettier.format(
  `// Generated from the shared TypeScript modules by npm run build.\nwindow.RetailInsights=(()=>{\n${source}\nreturn {importCSV,exportOrders,buildReport,defaultSelection,percentChange,exportReport,createSampleDataset,CATALOG,shiftDate,dayNumber};\n})();`,
  { parser: "babel" },
);
writeFileSync("public/core.js", bundle);
mkdirSync("fixtures", { recursive: true });
writeFileSync(
  "fixtures/summit-pine-orders.csv",
  exportOrders(createSampleDataset().lines),
);
const html = readFileSync("public/index.html", "utf8"),
  css = readFileSync("public/style.css", "utf8"),
  app = readFileSync("public/app.js", "utf8");
const standalone = html
  .replace(
    '<link rel="stylesheet" href="./style.css" />',
    `<style>${css}</style>`,
  )
  .replace(/\s*<script src="\.\/(core|app)\.js" defer><\/script>/g, "")
  .replace('href="./index.html"', 'href="#overview"')
  .replace(
    "</body>",
    `<script>${(bundle + "\n" + app).replace(/<\/script/gi, "<\\/script")}</script></body>`,
  );
writeFileSync(
  "demo.html",
  await prettier.format(standalone, { parser: "html" }),
);
