# capture/ — Lane C

Connect to the debug port (`127.0.0.1:9222`) via `chrome-remote-interface`,
enable the `Network` domain, inject a `fetch` monkey-patch
(`Page.addScriptToEvaluateOnNewDocument`), and dump matching response bodies to
`../data/raw/`.

For the Gavin Baker target this also drives **Level-3 scroll** to trigger the
`UserTweets` pagination fetches.

- Input: a running debug Chrome with a throwaway X session logged in.
- Filter: X GraphQL ops identified in Lane B (`UserByScreenName`, `UserTweets`, …).
- Output: raw response bodies → `data/raw/*.json`.

_Not implemented yet._
