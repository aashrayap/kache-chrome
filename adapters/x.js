// X (Twitter) adapter. Everything site-specific lives here; the engine is generic.
import { parseAny } from "../lib/x-graphql.js";

export default {
  name: "x",

  // which network responses are worth capturing
  match: (url) => /\/(UserTweets|UserTweetsAndReplies|UserByScreenName)\b/.test(url),

  // profile tabs to visit for a subject (handle)
  targets(subject, { tabs = ["posts", "replies"] } = {}) {
    const h = subject.replace(/^@/, "");
    const u = (t) =>
      t === "replies"
        ? `https://x.com/${h}/with_replies`
        : t === "media"
        ? `https://x.com/${h}/media`
        : `https://x.com/${h}`;
    return tabs.map((t) => ({ label: t, url: u(t) }));
  },

  // raw GraphQL body -> normalized records
  parse: (text) => parseAny(text),

  // dedupe key
  id: (rec) => rec.id,

  // the replies tab surfaces other people's tweets; keep only the subject's
  isPrimary: (rec, subject) =>
    rec.author?.toLowerCase() === subject.replace(/^@/, "").toLowerCase(),

  // digest view helpers
  engagement: (r) => (r.likes || 0) + (r.retweets || 0),
  fmtMetrics: (r) => `♥${r.likes ?? 0} ↻${r.retweets ?? 0}`,
};
