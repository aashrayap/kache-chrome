# capture/

Connect to the debug port (`127.0.0.1:9222`) via `chrome-remote-interface`,
enable the `Network` domain, inject a `fetch` monkey-patch
(`Page.addScriptToEvaluateOnNewDocument`), and dump matching response bodies to
`../data/raw/`.

The selected adapter supplies target pages and response filters. The engine
scrolls those pages to paginate until it reaches the item or idle limit, or
observes a matching HTTP 429 response.

- Input: a running debug Chrome with a throwaway session logged in.
- Adapter: `ADAPTER=x` by default; target supplied through `SUBJECT`.
- Output: raw response bodies → `data/raw/<adapter>-<run>-<page>.json`.

The X adapter parses captured records. The Reddit adapter provides targets and
filters, but its record parser is still a placeholder.
