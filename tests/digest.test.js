import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const source = fileURLToPath(new URL("../", import.meta.url));

async function digest(t, records) {
  const fixture = await mkdtemp(join(tmpdir(), "kache-digest-test-"));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  for (const dir of ["digest", "adapters", "lib"]) {
    await cp(join(source, dir), join(fixture, dir), { recursive: true });
  }
  await writeFile(join(fixture, "package.json"), '{"type":"module"}');
  await mkdir(join(fixture, "data"));
  await writeFile(join(fixture, "data", "example.jsonl"),
    records.map((record) => JSON.stringify(record)).join("\n"));
  await exec(process.execPath, [join(fixture, "digest", "index.js")], {
    env: { ...process.env, ADAPTER: "x", SUBJECT: "example", TOP: "25" },
  });
  return readFile(join(fixture, "data", "example.digest.md"), "utf8");
}

test("empty capture produces a digest without a date range", async (t) => {
  const output = await digest(t, []);
  assert.match(output, /\*\*0\*\* records · no dated records/);
  assert.match(output, /0 total engagement · 0 avg/);
});

test("capture containing only missing or invalid dates produces an empty digest", async (t) => {
  const output = await digest(t, [{}, { created_at: "invalid" }]);
  assert.match(output, /\*\*0\*\* records · no dated records/);
});

test("dated records retain the chronological range and engagement totals", async (t) => {
  const output = await digest(t, [
    { created_at: "2026-01-02", text: "Earlier", likes: 2, retweets: 1 },
    { created_at: "invalid", likes: 1000 },
    { created_at: "2026-03-04", text: "Later", likes: 4, retweets: 3 },
  ]);
  assert.match(output, /\*\*2\*\* records · 2026-01-02 → 2026-03-04/);
  assert.match(output, /10 total engagement · 5 avg/);
  assert.ok(output.indexOf("### 2026-03") < output.indexOf("### 2026-01"));
});
