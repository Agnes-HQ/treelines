import { expect, test } from "vitest";
import { connectorPath, layout, type Lane } from "../src";

const root = { width: 100, height: 30 };
const node = { width: 50, height: 20 };
const gap = { column: 10, row: 5, lane: 4 };

/** a > b, a > c, b > d, c > d (d has two parents), a > e */
const lanes: Lane<string>[] = [
  { root: "a", edges: [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"], ["a", "e"]] },
  { root: "x", edges: [] },
];

test("folded lanes stack along the cross axis, with the gap between them", () => {
  const l = layout({ lanes, rootSize: root, nodeSize: node, gap, start: 2 });
  expect(l.lanes.map((x) => [x.root, x.unfolded, x.nodes.map((n) => n.rect)])).toEqual([
    ["a", false, [{ x: 0, y: 2, width: 100, height: 30 }]],
    ["x", false, [{ x: 0, y: 36, width: 100, height: 30 }]],
  ]);
  expect(l.lanes[0]!.edges).toEqual([]);
  expect(l.lanes[0]!.band).toBeUndefined();
  expect([l.width, l.height]).toEqual([100, 70]);
});

test("an unfolded lane: columns by depth, rows that follow their parents, nothing overlapping", () => {
  const l = layout({ lanes, open: ["a"], rootSize: root, nodeSize: node, gap, padding: 3 });
  const a = l.lanes[0]!;
  expect(a.unfolded).toBe(true);
  // reading order: breadth first, in the edges' order
  expect(a.nodes.map((n) => [n.id, n.depth])).toEqual([["a", 0], ["b", 1], ["c", 1], ["e", 1], ["d", 2]]);
  const at = Object.fromEntries(a.nodes.map((n) => [n.id, n.rect]));
  // column 1 starts after the root and the gap; column 2 after column 1's width and the gap
  expect(at.b).toEqual({ x: 110, y: 0, width: 50, height: 20 });
  expect(at.c).toEqual({ x: 110, y: 25, width: 50, height: 20 });
  expect(at.e).toEqual({ x: 110, y: 50, width: 50, height: 20 });
  // d sits level with the average of its parents, b (0) and c (25)
  expect(at.d).toEqual({ x: 170, y: 12.5, width: 50, height: 20 });
  // the room it takes: from its top to its lowest node, padded on both sides
  expect(a.band).toEqual({ start: -3, size: 76 });
  // the next lane starts after the padding and the gap
  expect(l.lanes[1]!.nodes[0]!.rect.y).toBe(70 + 6 + 4);
  expect([l.width, l.height]).toEqual([220, 80 + 30 + 4]);
});

test("connectors run from the middle of a node's far side to the middle of the next one's near side", () => {
  const a = layout({ lanes, open: ["a"], rootSize: root, nodeSize: node, gap }).lanes[0]!;
  const ab = a.edges.find((e) => e.to === "b")!;
  expect(ab).toMatchObject({ from: "a", to: "b", via: [], start: { x: 100, y: 15 }, end: { x: 110, y: 10 }, mid: { x: 105, y: 12.5 } });
  expect(ab.path).toBe("M100 15 C105 15, 105 10, 110 10");
  expect(a.edges).toHaveLength(5);
});

test("ties go to the order nodes first appear in, or to compare", () => {
  const flat: Lane<string>[] = [{ root: "r", edges: [["r", "z"], ["r", "m"], ["r", "a"]] }];
  const rows = (compare?: (a: string, b: string) => number) =>
    layout({ lanes: flat, open: ["r"], rootSize: root, nodeSize: node, gap, compare }).lanes[0]!.nodes.slice(1).toSorted((p, q) => p.rect.y - q.rect.y).map((n) => n.id);
  expect(rows()).toEqual(["z", "m", "a"]);
  expect(rows((p, q) => p.localeCompare(q))).toEqual(["a", "m", "z"]);
});

test("sizes per node: a column is as wide as its widest node, a row as tall as its own node", () => {
  const sizes: Record<string, { width: number; height: number }> = { b: { width: 80, height: 40 }, c: { width: 30, height: 10 }, e: { width: 50, height: 20 }, d: { width: 60, height: 20 } };
  const l = layout({ lanes, open: ["a"], rootSize: root, nodeSize: (id) => sizes[id]!, gap });
  const at = Object.fromEntries(l.lanes[0]!.nodes.map((n) => [n.id, n.rect]));
  expect([at.b!.y, at.c!.y, at.e!.y]).toEqual([0, 45, 60]);
  // column 2 starts after column 1's widest node (b, 80)
  expect(at.d!.x).toBe(100 + 10 + 80 + 10);
});

test("growing downwards: lanes side by side, columns become rows", () => {
  const l = layout({ lanes, open: ["a"], rootSize: root, nodeSize: node, gap, direction: "down" });
  const at = Object.fromEntries(l.lanes[0]!.nodes.map((n) => [n.id, n.rect]));
  // the root is 30 tall along the main axis (down) and 100 wide across
  expect(at.a).toEqual({ x: 0, y: 0, width: 100, height: 30 });
  expect(at.b).toEqual({ x: 0, y: 40, width: 50, height: 20 });
  expect(at.c).toEqual({ x: 55, y: 40, width: 50, height: 20 });
  const ab = l.lanes[0]!.edges.find((e) => e.to === "b")!;
  expect(ab).toMatchObject({ start: { x: 50, y: 30 }, end: { x: 25, y: 40 } });
  expect(ab.path).toBe("M50 30 C50 35, 25 35, 25 40");
  expect(l.lanes[1]!.nodes[0]!.rect.x).toBeGreaterThan(at.c!.x);
});

test("connector shapes", () => {
  const s = { x: 0, y: 0 };
  const e = { x: 10, y: 20 };
  expect(connectorPath(s, e)).toBe("M0 0 C5 0, 5 20, 10 20");
  expect(connectorPath(s, e, "elbow")).toBe("M0 0 H5 V20 H10");
  expect(connectorPath(s, e, "straight")).toBe("M0 0 L10 20");
  expect(connectorPath(s, e, "elbow", "down")).toBe("M0 0 V10 H10 V20");
});

test("a lane with nothing below stays folded even when asked to open; cycles end; unknown nodes are left out", () => {
  const l = layout({ lanes, open: ["x"], rootSize: root, nodeSize: node, gap });
  expect(l.lanes[1]).toMatchObject({ open: true, unfolded: false });
  const cyclic: Lane<string>[] = [{ root: "a", edges: [["a", "b"], ["b", "c"], ["c", "b"], ["c", "a"]] }];
  const c = layout({ lanes: cyclic, open: ["a"], rootSize: root, nodeSize: node, gap }).lanes[0]!;
  expect(c.nodes.map((n) => [n.id, n.depth])).toEqual([["a", 0], ["b", 1], ["c", 2]]);
  expect(c.edges).toHaveLength(4);
  expect(layout({ lanes: [], rootSize: root, nodeSize: node })).toEqual({ lanes: [], width: 0, height: 0 });
});
