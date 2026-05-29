// Walk X (Twitter) GraphQL UserTweets / UserTweetsAndReplies responses into
// flat tweet records. The shape drifts over time, so every access is
// optional-chained and entries that don't match are skipped rather than thrown.

const num = (v) => (typeof v === "number" ? v : 0);

function extractLegacy(result) {
  if (!result) return null;
  // tweet may be at result.legacy, or wrapped (TweetWithVisibilityResults -> result.tweet.legacy)
  const tweet = result.tweet || result;
  const legacy = tweet.legacy;
  if (!legacy) return null;
  // X migrated user fields from legacy -> a `core` object; read both.
  const userResult =
    tweet.core?.user_results?.result ||
    result.core?.user_results?.result;
  const screen =
    userResult?.core?.screen_name ||
    userResult?.legacy?.screen_name ||
    "";
  const id = legacy.id_str || tweet.rest_id || result.rest_id;
  if (!id) return null;
  const full = legacy.full_text ?? legacy.text ?? "";
  return {
    id,
    created_at: legacy.created_at || "",
    author: screen,
    text: full,
    likes: num(legacy.favorite_count),
    retweets: num(legacy.retweet_count),
    replies: num(legacy.reply_count),
    quotes: num(legacy.quote_count),
    is_retweet: Boolean(legacy.retweeted_status_result) || /^RT @/.test(full),
    url: screen ? `https://x.com/${screen}/status/${id}` : "",
  };
}

function walkEntries(entries, out) {
  for (const entry of entries || []) {
    const content = entry?.content;
    if (!content) continue;
    const r = content.itemContent?.tweet_results?.result;
    if (r) {
      const rec = extractLegacy(r);
      if (rec) out.push(rec);
    }
    // conversation modules nest tweets under content.items[].item
    for (const sub of content.items || []) {
      const sr = sub?.item?.itemContent?.tweet_results?.result;
      if (sr) {
        const rec = extractLegacy(sr);
        if (rec) out.push(rec);
      }
    }
  }
}

export function parseUserTweets(json) {
  const out = [];
  const instructions =
    json?.data?.user?.result?.timeline_v2?.timeline?.instructions ||
    json?.data?.user?.result?.timeline?.timeline?.instructions ||
    [];
  for (const ins of instructions) {
    if (ins.entries) walkEntries(ins.entries, out);
    if (ins.entry) walkEntries([ins.entry], out); // TimelinePinEntry
  }
  return out;
}

export function parseAny(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }
  return parseUserTweets(json);
}
