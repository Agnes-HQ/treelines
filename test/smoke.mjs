// After `npm run build`: the published files load in ESM and CommonJS, export what the README promises, and only the
// React entry is a client module.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const esm = await import("../dist/index.js");
const core = await import("../dist/core.js");
const require = createRequire(import.meta.url);
const cjs = require("../dist/index.cjs");
const cjsCore = require("../dist/core.cjs");

for (const name of ["layout", "connectorPath", "trace", "onTrace", "foldPassThrough", "fromTree"]) {
  for (const [label, mod] of [["esm", esm], ["esm core", core], ["cjs", cjs], ["cjs core", cjsCore]]) assert.equal(typeof mod[name], "function", `${label}: ${name}`);
}
for (const mod of [esm, cjs]) {
  for (const part of ["Root", "Canvas", "Bands", "Connectors", "Markers", "Nodes", "Node"]) assert.equal(typeof mod.Graph[part], "function", `Graph.${part}`);
  assert.equal(typeof mod.useGraph, "function");
  assert.equal(typeof mod.useNode, "function");
}
assert.equal(core.Graph, undefined, "the core has no React parts");
assert.match(readFileSync(new URL("../dist/index.js", import.meta.url), "utf8"), /^"use client";/, "index.js is a client module");
assert.doesNotMatch(readFileSync(new URL("../dist/core.js", import.meta.url), "utf8"), /use client/, "core.js is not");

const { lanes } = core.fromTree([{ id: "a", c: [{ id: "b" }] }], (n) => n.id, (n) => n.c);
const result = core.layout({ lanes, open: ["a"], rootSize: { width: 10, height: 10 }, nodeSize: { width: 10, height: 10 }, gap: { column: 5 } });
assert.deepEqual(result.lanes[0].nodes.map((n) => [n.id, n.rect.x]), [["a", 0], ["b", 15]]);
console.log("smoke: ok");
