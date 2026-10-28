# Security and data handling

The shipped dataset is fictional. The dashboard has no account, upload endpoint, telemetry, external font/script or live API credential. Imports are read using the browser's File API and retained only in page memory. Reloading clears imported data and reconstructs the sample dataset.

Text is inserted using DOM text nodes, not HTML interpolation. CSVs are validated before replacing the current dataset. Report exports escape common spreadsheet-formula prefixes. The local preview serves an explicit file allowlist with a restrictive Content Security Policy and has no POST handler.

Keep real customer files outside the repository. `imports/`, environment files, logs and build intermediates are ignored. Do not paste confidential CSV content into public issues or commit it while preparing screenshots. Downloaded reports remain on the user's device and require their own handling and retention choices.

For a vulnerability, use GitHub private vulnerability reporting if enabled, or a private contact channel you already trust. Do not publish credentials or real datasets in an issue. No reporting address is invented here.
