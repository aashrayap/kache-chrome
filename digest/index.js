// Adapter-driven view layer — renders data/<subject>.jsonl into a Markdown
// digest: stats, top records by engagement, chronological-by-month log.
// adapter.engagement / adapter.fmtMetrics make it site-agnostic.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const NAME = process.env.ADAPTER || "x";
const SUBJECT = process.env.SUBJECT || process.env.HANDLE || "GavinSBaker";
const slug = SUBJECT.replace(/^[@/]+/, "").replace(/^u\//, "");
const adapter = (await import(`../adapters/${NAME}.js`)).default;
const eng = adapter.engagement || ((r) => (r.likes || 0) + (r.retweets || 0));
const fmt = adapter.fmtMetrics || ((r) => `♥${r.likes ?? 0}`);
const TOP = Number(process.env.TOP || 25);

const SRC = fileURLToPath(new URL(`../data/${slug}.jsonl`, import.meta.url));
const OUT = fileURLToPath(new URL(`../data/${slug}.digest.md`, import.meta.url));

const clean = (t) => (t || "").replace(/\s+/g, " ").trim();
const dt = (s) => new Date(s);
const ymd = (x) => x.toISOString().slice(0, 10);
const ym = (x) => x.toISOString().slice(0, 7);

const recs = (await readFile(SRC, "utf8"))
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => r.created_at && !isNaN(dt(r.created_at)));
recs.sort((a, b) => dt(b.created_at) - dt(a.created_at));

const dates = recs.map((r) => dt(r.created_at));
const totalEng = recs.reduce((s, r) => s + eng(r), 0);
const monthCounts = new Map();
for (const r of recs) {
  const m = ym(dt(r.created_at));
  monthCounts.set(m, (monthCounts.get(m) || 0) + 1);
}

let md = `# @${slug} — ${adapter.name} digest\n\n`;
md += `- **${recs.length}** records · ${ymd(new Date(Math.min(...dates)))} → ${ymd(new Date(Math.max(...dates)))}\n`;
md += `- ${totalEng.toLocaleString()} total engagement · ${Math.round(totalEng / (recs.length || 1)).toLocaleString()} avg\n`;
md += `- source: \`data/${slug}.jsonl\` · regenerate: \`ADAPTER=${NAME} SUBJECT=${slug} npm run digest\`\n\n`;

md += `## Top ${TOP} by engagement\n\n`;
for (const r of [...recs].sort((a, b) => eng(b) - eng(a)).slice(0, TOP)) {
  md += `- **${fmt(r)}** · ${ymd(dt(r.created_at))}${r.is_retweet ? " · RT" : ""}\n  ${clean(r.text)} — [link](${r.url})\n`;
}

md += `\n## Chronological (newest first)\n`;
let cur = "";
for (const r of recs) {
  const m = ym(dt(r.created_at));
  if (m !== cur) {
    cur = m;
    md += `\n### ${m} (${monthCounts.get(m)})\n\n`;
  }
  md += `- **${ymd(dt(r.created_at))}** — ${clean(r.text)} *(${fmt(r)})* [↗](${r.url})\n`;
}

await writeFile(OUT, md);
console.error(`[digest] ${recs.length} records -> ${OUT} (${(md.length / 1024).toFixed(0)}K)`);
