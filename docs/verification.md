# Verification record

Prepared 28 October 2026, Australia/Perth. All demonstration data concerns fictional outdoor-retail products.

`npm run check` passed all **31 tests**, including exact-cent calculations, distinct-order counting, full refunds, payment-status exclusions, date/calendar boundaries, comparison coverage, filtering, sales reconciliation, CSV quoting, malformed imports, duplicate identifiers, metadata consistency, minor-unit currency rejection, safe-integer limits, formula-prefix escaping and shared browser/CLI calculation parity. Formatting and strict TypeScript compilation passed. The production-dependency audit reported no vulnerabilities.

The command-line demo imports the generated sample CSV, builds a 30-day report, verifies daily/product totals and emits an export. No store credentials or external service requests are needed.

Browser smoke checks on the local served interface verified:

- Date, channel and category filters working together; the 90-day view suppresses unavailable comparisons.
- Keyboard day inspection, product search and an empty search state with export disabled.
- A custom date error preserving the previous report and recovery through a valid range.
- Filtered CSV download: 22–28 October, Online store, Shelter, AUD 837.00 across three paid orders; the downloaded row matched the screen.
- Duplicate-line CSV rejection preserving the current report, followed by a successful 608-line sample import and sample restoration.
- Metric definitions, Escape to close the dialog and focus returning to its trigger.
- A 390 × 844 responsive viewport with a 390-pixel document width and no page-level horizontal overflow. This is browser emulation, not a physical-device or assistive-technology audit.

The baseline fictional 30-day report shows AUD 22,684.70 net product sales, 177 paid orders, AUD 700.00 refunded sales and eight products. These are synthetic demo results, not client performance claims. Desktop and mobile screenshots are in `docs/images/`.

The portable HTML includes its own scripts/styles. Automated file-protocol browser inspection is unavailable; browser QA uses the local served interface, with separate checks of the standalone artifact's structure and shared calculation bundle.

See the repository's Actions page for the current Linux/macOS CI results. This record does not claim a live-store connector, accounting certification, full accessibility audit, large-volume load test or validation of any real business's export.
