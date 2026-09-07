// Adapter-driven parse. Reads every raw page + the existing output, normalizes
// via adapter.parse, dedupes via adapter.id, keeps the subject's own records via
// adapter.isPrimary, writes data/<subject>.jsonl. Accumulates — never shrinks.

import { randomUUID } from "node:crypto";
import { open, readdir, readFile, rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const NAME = process.env.ADAPTER || "x";
const SUBJECT = process.env.SUBJECT || process.env.HANDLE || "GavinSBaker";
const slug = SUBJECT.replace(/^[@/]+/, "").replace(/^u\//, "");
const adapter = (await import(`../adapters/${NAME}.js`)).default;

const RAW_DIR = fileURLToPath(new URL("../data/raw/", import.meta.url));
const OUT = fileURLToPath(new URL(`../data/${slug}.jsonl`, import.meta.url));

const byId = new Map();

// Seed from existing output so reruns ACCUMULATE (a small/rate-limited capture
// can't clobber a larger prior result).
let prev = "";
try {
  prev = await readFile(OUT, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
for (const [index, line] of prev.split("\n").entries()) {
  if (!line.trim()) continue;
  try {
    const r = JSON.parse(line);
    const k = adapter.id(r);
    if (typeof k !== "string" || !k.trim()) throw new Error("Invalid record ID");
    byId.set(k, r);
  } catch {
    throw new Error(`[parse] Invalid JSON or record ID in existing history ${OUT}, line ${index + 1}`);
  }
}
const seeded = byId.size;

let files = [];
try {
  files = (await readdir(RAW_DIR)).filter((f) => f.endsWith(".json")).sort();
} catch {}
for (const f of files) {
  const text = await readFile(`${RAW_DIR}${f}`, "utf8");
  for (const r of adapter.parse(text)) {
    const k = adapter.id(r);
    if (k && !byId.has(k)) byId.set(k, r);
  }
}
console.error(`[parse] seeded ${seeded}, +${byId.size - seeded} from ${files.length} raw pages`);

const all = [...byId.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
const recs = process.env.ALL === "1" ? all : all.filter((r) => adapter.isPrimary(r, SUBJECT));
const body = recs.map((r) => JSON.stringify(r)).join("\n");
const temporary = `${OUT}.${randomUUID()}.tmp`;
const file = await open(temporary, "wx", 0o600);
try {
  try {
    await file.writeFile(body ? body + "\n" : "", "utf8");
  } finally {
    await file.close();
  }
  await rename(temporary, OUT);
} finally {
  await rm(temporary, { force: true });
}
console.error(`[parse] ${recs.length} records for ${slug} (of ${all.length} captured) -> ${OUT}`);
