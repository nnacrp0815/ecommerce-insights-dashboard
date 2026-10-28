import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const files = new Map([
  ["/", ["public/index.html", "text/html"]],
  ["/index.html", ["public/index.html", "text/html"]],
  ["/style.css", ["public/style.css", "text/css"]],
  ["/app.js", ["public/app.js", "text/javascript"]],
  ["/core.js", ["public/core.js", "text/javascript"]],
]);
const port = Number(process.env.PORT ?? 3100);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid PORT");
const server = createServer((req, res) => {
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader(
    "content-security-policy",
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  );
  const entry = files.get(new URL(req.url ?? "/", "http://localhost").pathname);
  if (req.method !== "GET" || !entry) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  try {
    res.writeHead(200, { "content-type": `${entry[1]}; charset=utf-8` });
    res.end(readFileSync(entry[0]));
  } catch {
    res.writeHead(503);
    res.end("Preview assets unavailable");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Summit & Pine preview: http://127.0.0.1:${port}`),
);
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
