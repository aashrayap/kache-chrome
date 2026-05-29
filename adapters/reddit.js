// SECOND ADAPTER — proves the plug-and-play seam: the generic engine accepts
// this with zero changes. `match`/`targets` are real; `parse` is the only piece
// that still needs Lane-B endpoint discovery (run capture once, inspect
// data/raw/, then walk the JSON). Until then it yields nothing.

export default {
  name: "reddit",

  // new Reddit SPA fetches from these; refine after inspecting a real capture
  match: (url) => /\/(svc\/shreddit|graphql|\.json)(\?|$)/.test(url),

  targets(subject) {
    const u = subject.replace(/^\/?u\//, "").replace(/^\//, "");
    return [
      { label: "submitted", url: `https://www.reddit.com/user/${u}/submitted/` },
      { label: "comments", url: `https://www.reddit.com/user/${u}/comments/` },
    ];
  },

  // TODO(lane-b): inspect captured data/raw/reddit-*.json, then map ->
  // { id, created_at, author, text, score, url }
  parse: (_text) => [],

  id: (rec) => rec.id,
  isPrimary: () => true,
  engagement: (r) => r.score || 0,
  fmtMetrics: (r) => `▲${r.score ?? 0}`,
};
