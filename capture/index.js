// Thin CLI — pick an adapter, run the generic engine.
//   ADAPTER=x SUBJECT=GavinSBaker TABS=posts,replies node capture/index.js
//   ADAPTER=reddit SUBJECT=u/spez node capture/index.js
//
// Prereq: ./launch/safe-debug-chrome.sh running + a throwaway account logged
// into that Chrome profile for the target site.

import { runEngine } from "./engine.js";

const NAME = process.env.ADAPTER || "x";
const SUBJECT = process.env.SUBJECT || process.env.HANDLE || "GavinSBaker";
const opts = {};
if (process.env.TABS) opts.tabs = process.env.TABS.split(",").map((s) => s.trim());

const adapter = (await import(`../adapters/${NAME}.js`)).default;
console.error(`[capture] adapter=${adapter.name} subject=${SUBJECT}`);
await runEngine(adapter, SUBJECT, opts);
process.exit(0);
