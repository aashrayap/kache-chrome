// Generic, site-agnostic capture engine. Drives a logged-in Chrome over CDP,
// eavesdrops on the network responses an adapter cares about, scroll-paginates,
// saves raw bodies, and live-dedupes via the adapter. Knows nothing about X.
//
// An adapter supplies: name, match(url), targets(subject, opts) -> [{label,url}],
// parse(rawText) -> records[], id(rec). (isPrimary/engagement/fmtMetrics are
// used downstream by parse/digest, not here.)

import CDP from "chrome-remote-interface";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const RAW_DIR = fileURLToPath(new URL("../data/raw/", import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runEngine(adapter, subject, opts = {}) {
  const port = Number(opts.port || process.env.CDP_PORT || 9222);
  const maxItems = Number(opts.maxItems || process.env.MAX_ITEMS || process.env.MAX_TWEETS || 10000);
  const maxIdle = Number(opts.maxIdle || process.env.MAX_IDLE || 6);
  const scrollWait = Number(opts.scrollWait || process.env.SCROLL_WAIT || 3000);

  await mkdir(RAW_DIR, { recursive: true });
  const RUN = `${adapter.name}-${Date.now().toString(36)}`; // run-unique raw prefix

  const list = await CDP.List({ port });
  const pageT = list.find((t) => t.type === "page") || (await CDP.New({ port }));
  const client = await CDP({ port, target: pageT.webSocketDebuggerUrl || pageT.id });
  const { Network, Page, Runtime } = client;
  await Promise.all([Network.enable(), Page.enable(), Runtime.enable()]);

  // kache-faithful: monkey-patch fetch for visible page-console taps. Real
  // capture is the CDP Network domain below (no size cap).
  await Page.addScriptToEvaluateOnNewDocument({
    source: `(()=>{const o=window.fetch;window.fetch=async(...a)=>{const r=await o(...a);try{console.debug("[ingest] fetch",String((a[0]&&a[0].url)||a[0]||""));}catch{}return r;};})();`,
  });

  const pending = new Map();
  const seen = new Set();
  let pages = 0;
  let rateLimited = false;

  Network.responseReceived(({ requestId, response }) => {
    if (adapter.match(response.url)) {
      pending.set(requestId, response.url);
      if (response.status === 429) rateLimited = true;
    }
  });

  Network.loadingFinished(async ({ requestId }) => {
    const url = pending.get(requestId);
    if (!url) return;
    pending.delete(requestId);
    try {
      const { body, base64Encoded } = await Network.getResponseBody({ requestId });
      const text = base64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
      pages += 1;
      await writeFile(`${RAW_DIR}${RUN}-${String(pages).padStart(4, "0")}.json`, text);
      let fresh = 0;
      for (const rec of adapter.parse(text)) {
        const key = adapter.id(rec);
        if (key && !seen.has(key)) { seen.add(key); fresh += 1; }
      }
      console.error(`[engine] page ${pages}: +${fresh} new (total ${seen.size})`);
    } catch (e) {
      console.error("[engine] body fetch failed:", e.message);
    }
  });

  for (const t of adapter.targets(subject, opts)) {
    if (rateLimited || seen.size >= maxItems) break;
    console.error(`[engine] ${adapter.name} :: ${t.label} -> ${t.url}`);
    await Page.navigate({ url: t.url });
    await Page.loadEventFired().catch(() => {});
    await sleep(3500);
    let idle = 0;
    let last = -1;
    while (seen.size < maxItems && idle < maxIdle && !rateLimited) {
      await Runtime.evaluate({ expression: "window.scrollTo(0, document.body.scrollHeight)" });
      await sleep(scrollWait + Math.floor(Math.random() * 900)); // jitter eases rate limits
      if (seen.size === last) idle += 1; else idle = 0;
      last = seen.size;
    }
    console.error(`[engine] ${t.label} done — total ${seen.size}${rateLimited ? " RATE LIMITED (429)" : ""}`);
  }

  console.error(`[engine] DONE — ${seen.size} unique items across ${pages} pages (run ${RUN})`);
  await client.close();
  return { count: seen.size, pages };
}
