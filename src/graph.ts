import type { Edge, Id, Lane } from "./layout";

/**
 * Working with the graph itself, apart from where it is drawn: the routes through a node, folding the nodes that only
 * pass a route on, and turning nested data into lanes.
 */

export interface Trace<I extends Id = Id> {
  /** The node and everything that leads to it. */
  up: Set<I>;
  /** The node and everything it leads to. */
  down: Set<I>;
}

/** Every route through `id`: what leads to it and what it leads to. For highlighting a node's routes on hover. */
export function trace<I extends Id>(edges: readonly Edge<I, unknown>[], id: I): Trace<I> {
  const up = new Set([id]);
  const down = new Set([id]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const [a, b] of edges) {
      if (up.has(b) && !up.has(a)) {
        up.add(a);
        changed = true;
      }
      if (down.has(a) && !down.has(b)) {
        down.add(b);
        changed = true;
      }
    }
  }
  return { up, down };
}

/** Whether an edge lies on a route through the traced node: both ends lead to it, or both come from it. */
export const onTrace = <I extends Id>(t: Trace<I>, [a, b]: Edge<I, unknown>): boolean => (t.up.has(a) && t.up.has(b)) || (t.down.has(a) && t.down.has(b));

/**
 * Folds the nodes that only pass a route on: a node that is not the root, not kept, and has exactly one parent and one
 * child becomes part of the edge around it, listed in its `via`. A long chain of such nodes becomes one edge with a "+N".
 * A loop that folds back onto where it started is left out.
 */
export function foldPassThrough<I extends Id>(edges: readonly Edge<I, unknown>[], root: I, keep: (id: I) => boolean): Edge<I, I>[] {
  const kids = new Map<I, I[]>();
  const parents = new Map<I, I[]>();
  for (const [a, b] of edges) {
    kids.set(a, [...(kids.get(a) ?? []), b]);
    parents.set(b, [...(parents.get(b) ?? []), a]);
  }
  const kept = (id: I) => id === root || keep(id) || kids.get(id)?.length !== 1 || parents.get(id)?.length !== 1;
  const out: Edge<I, I>[] = [];
  for (const [a, b] of edges) {
    if (!kept(a)) continue;
    const via: I[] = [];
    let at = b;
    // a cycle of pass-through nodes would never end: stop where the route returns
    while (!kept(at) && !via.includes(at)) {
      via.push(at);
      at = kids.get(at)![0]!;
    }
    // a loop folded down to where it started draws nothing
    if (at !== a) out.push([a, at, via]);
  }
  return out;
}

/**
 * Nested data as lanes: one per top-level item, its edges running from every node to its children. The same id twice
 * is the same node, so shared children (a graph rather than a tree) work too.
 */
export function fromTree<T, I extends Id>(roots: readonly T[], getId: (node: T) => I, getChildren: (node: T) => readonly T[] | null | undefined): { lanes: Lane<I, never>[]; nodes: Map<I, T> } {
  const nodes = new Map<I, T>();
  const lanes = roots.map((root) => {
    const edges: Edge<I, never>[] = [];
    const seen = new Set<string>();
    const visited = new Set<I>();
    const walk = (node: T) => {
      const id = getId(node);
      nodes.set(id, node);
      if (visited.has(id)) return;
      visited.add(id);
      for (const child of getChildren(node) ?? []) {
        const to = getId(child);
        const key = `${String(id)}\u0000${String(to)}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push([id, to]);
        }
        walk(child);
      }
    };
    walk(root);
    return { root: getId(root), edges };
  });
  return { lanes, nodes };
}
