import { expect, test } from "vitest";
import { foldPassThrough, fromTree, onTrace, trace, type Edge } from "../src";

const edges: Edge<string>[] = [["r", "a"], ["a", "b"], ["b", "x"], ["r", "c"], ["c", "x"], ["x", "y"]];

test("the routes through a node: what leads to it and what it leads to", () => {
  const t = trace(edges, "b");
  expect([...t.up].toSorted()).toEqual(["a", "b", "r"]);
  expect([...t.down].toSorted()).toEqual(["b", "x", "y"]);
  expect(onTrace(t, ["a", "b"])).toBe(true);
  expect(onTrace(t, ["x", "y"])).toBe(true);
  // c leads to x, but not through b
  expect(onTrace(t, ["c", "x"])).toBe(false);
  expect(trace([["a", "b"], ["b", "a"]], "a").down).toEqual(new Set(["a", "b"]));
});

test("folding the nodes that only pass a route on", () => {
  // a and b each have one parent and one child: r > a > b > x folds into one edge via a and b; c stays (kept)
  expect(foldPassThrough(edges, "r", (id) => id === "c" || id === "y")).toEqual([
    ["r", "x", ["a", "b"]],
    ["r", "c", []],
    ["c", "x", []],
    ["x", "y", []],
  ]);
  // a node with two children is a branch, never folded
  expect(foldPassThrough([["r", "a"], ["a", "b"], ["a", "c"]], "r", () => false)).toEqual([["r", "a", []], ["a", "b", []], ["a", "c", []]]);
  // a loop of pass-through nodes ends where it returns; one that folds back onto its start draws nothing
  expect(foldPassThrough([["r", "a"], ["a", "b"], ["b", "a"]], "r", () => false)).toEqual([["r", "a", []]]);
  // a only passes the route on to b (which has two parents, a and c): r > b via a; b > c > b folds onto b and goes
  expect(foldPassThrough([["r", "a"], ["a", "b"], ["b", "c"], ["c", "b"]], "r", () => false)).toEqual([["r", "b", ["a"]]]);
});

test("nested data as lanes, shared ids as one node", () => {
  type T = { id: string; children?: T[] };
  const shared: T = { id: "s" };
  const data: T[] = [
    { id: "a", children: [{ id: "b", children: [shared] }, { id: "c", children: [shared] }] },
    { id: "z" },
  ];
  const { lanes, nodes } = fromTree(data, (n) => n.id, (n) => n.children);
  expect(lanes).toEqual([
    { root: "a", edges: [["a", "b"], ["b", "s"], ["a", "c"], ["c", "s"]] },
    { root: "z", edges: [] },
  ]);
  expect([...nodes.keys()]).toEqual(["a", "b", "s", "c", "z"]);
});
