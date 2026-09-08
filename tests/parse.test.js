import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const source = fileURLToPath(new URL("../", import.meta.url));
const previous = { id: "old", author: "example", created_at: "2026-01-01", text: "Saved text" };

async function fixture(t, history, records = []) {
  const root = await mkdtemp(join(tmpdir(), "kache-parse-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ["parse", "adapters", "lib"]) {
    await cp(join(source, dir), join(root, dir), { recursive: true });
  }
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await mkdir(join(root, "data", "raw"), { recursive: true });
  const output = join(root, "data", "example.jsonl");
  if (history !== null) await writeFile(output, history, { mode: 0o644 });
  const entries = records.map(({ id, text, author = "example" }) => ({
    content: { itemContent: { tweet_results: { result: {
      legacy: { id_str: id, full_text: text, created_at: "2026-02-01" },
      core: { user_results: { result: { legacy: { screen_name: author } } } },
    } } } },
  }));
  const page = { data: { user: { result: { timeline_v2: {
    timeline: { instructions: [{ entries }] },
  } } } } };
  await writeFile(join(root, "data", "raw", "x-page.json"), JSON.stringify(page));
  return {
    root,
    output,
    run: () => exec(process.execPath, [join(root, "parse", "index.js")], {
      env: { ...process.env, ADAPTER: "x", SUBJECT: "example", ALL: "" },
    }),
  };
}

test("accumulation replaces the output privately while preserving saved values and subject filtering", async (t) => {
  const history = JSON.stringify(previous) + "\n";
  const f = await fixture(t, history, [
    { id: "old", text: "Recaptured text" },
    { id: "new", text: "New text" },
    { id: "other", text: "Another author's text", author: "other" },
  ]);
  const original = await open(f.output, "r");
  t.after(() => original.close());
  const before = await original.stat();
  await f.run();
  const rows = (await readFile(f.output, "utf8")).trim().split("\n").map(JSON.parse);
  assert.deepEqual(rows.map((row) => row.id), ["new", "old"]);
  assert.deepEqual(rows.find((row) => row.id === "old"), previous);
  const after = await stat(f.output);
  assert.notEqual(after.ino, before.ino);
  assert.equal(after.mode & 0o777, 0o600);
  assert.equal(await original.readFile("utf8"), history);
  assert.deepEqual((await readdir(join(f.root, "data"))).sort(), ["example.jsonl", "raw"]);
});

test("absent previous output initializes a new history file", async (t) => {
  const f = await fixture(t, null, [{ id: "new", text: "New text" }]);
  await f.run();
  assert.equal(JSON.parse((await readFile(f.output, "utf8")).trim()).id, "new");
});

for (const [name, invalid] of [
  ["malformed JSON", "{broken"],
  ["missing ID", JSON.stringify({ author: "example" })],
  ["blank ID", JSON.stringify({ id: " ", author: "example" })],
  ["non-string ID", JSON.stringify({ id: {}, author: "example" })],
]) {
  test(`${name} in existing history fails without changing the file`, async (t) => {
    const history = JSON.stringify(previous) + "\n" + invalid + "\n";
    const f = await fixture(t, history, [{ id: "new", text: "New text" }]);
    const before = await stat(f.output);
    await assert.rejects(f.run(), (error) => {
      assert.match(error.stderr, /existing.*line 2/i);
      return true;
    });
    assert.equal(await readFile(f.output, "utf8"), history);
    assert.equal((await stat(f.output)).ino, before.ino);
    assert.deepEqual((await readdir(join(f.root, "data"))).sort(), ["example.jsonl", "raw"]);
  });
}

test("an existing output read failure is reported before parsing new captures", async (t) => {
  const f = await fixture(t, null);
  await mkdir(f.output);
  await assert.rejects(f.run(), (error) => {
    assert.match(error.stderr, /EISDIR.*read/);
    assert.doesNotMatch(error.stderr, /seeded/);
    return true;
  });
  assert.ok((await stat(f.output)).isDirectory());
});
