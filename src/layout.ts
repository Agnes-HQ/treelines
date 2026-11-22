/**
 * The layout: where every node goes and the path of every connector, from the graph and the node sizes alone. No DOM and
 * no React, so it runs anywhere (the server included) and gives the same numbers every time.
 *
 * The shape it draws: a list of lanes, each a root you can unfold. An unfolded lane shows the graph below its root
 * beside it, in columns by depth: a node's column is its distance from the root, its row follows its parents (the average
 * of where they are), pushed further along so nothing overlaps. Lanes stack, the open ones with room around them.
 *
 * "Main" is the axis the graph grows along (x when it grows to the right), "cross" the one lanes and rows stack along.
 */

export type Id = string | number;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

/** From, to, and optionally what was folded into it (see `foldPassThrough`): opaque to the layout, counted by renderers. */
export type Edge<I extends Id = Id, V = unknown> = readonly [from: I, to: I, via?: readonly V[]];

/** A root and the graph that unfolds from it. The edges should only reach nodes below the root. */
export interface Lane<I extends Id = Id, V = unknown> {
  root: I;
  edges: readonly Edge<I, V>[];
}

/** Which way the graph grows from its root: to the right (lanes stack downwards), or down (lanes sit side by side). */
export type Direction = "right" | "down";

/** How a connector runs: a smooth S-curve, right angles, or a straight line. */
export type ConnectorShape = "curve" | "elbow" | "straight";

export interface LayoutOptions<I extends Id = Id, V = unknown> {
  lanes: readonly Lane<I, V>[];
  /** The roots whose graph is unfolded. A lane without edges has nothing to unfold and stays folded. */
  open?: Iterable<I>;
  /** The size of a lane's root. */
  rootSize: Size | ((id: I) => Size);
  /** The size of the nodes below it; `depth` is 1 for the root's children. */
  nodeSize: Size | ((id: I, depth: number) => Size);
  gap?: {
    /** Between columns, from the root's column on. */
    column?: number;
    /** Between nodes in one column. */
    row?: number;
    /** Between lanes. */
    lane?: number;
  };
  /** Room kept around an unfolded lane (its `band`), on both sides along the cross axis. */
  padding?: number;
  /** Where the first lane starts along the cross axis. */
  start?: number;
  direction?: Direction;
  shape?: ConnectorShape;
  /** Breaks ties between nodes that want the same row: by default the order they first appear in. */
  compare?: (a: I, b: I) => number;
}

export interface PlacedNode<I extends Id = Id> {
  id: I;
  /** 0 for the root. */
  depth: number;
  rect: Rect;
}

export interface PlacedEdge<I extends Id = Id, V = unknown> {
  from: I;
  to: I;
  via: readonly V[];
  /** Where it leaves `from` (the middle of its far side) and enters `to` (the middle of its near side). */
  start: Point;
  end: Point;
  /** Halfway between them: where a "+N" marker for the folded nodes goes. */
  mid: Point;
  /** An SVG path: `<path d={edge.path} />`. */
  path: string;
}

export interface PlacedLane<I extends Id = Id, V = unknown> {
  root: I;
  /** Asked to be open (see `LayoutOptions.open`). */
  open: boolean;
  /** Open and with something to show. */
  unfolded: boolean;
  /** The root first, then the nodes below it in reading order (breadth first), which is also a good tab order. */
  nodes: PlacedNode<I>[];
  edges: PlacedEdge<I, V>[];
  /**
   * The room an unfolded lane takes along the cross axis, padding included: for a background behind it. It runs the whole
   * width of the layout along the main axis.
   */
  band?: { start: number; size: number };
}

export interface Layout<I extends Id = Id, V = unknown> {
  lanes: PlacedLane<I, V>[];
  /** The far edge of the furthest node, and where the next lane would start: the layout's size. */
  width: number;
  height: number;
}

/** Positions along the two axes, before they become x and y. */
interface Box {
  main: number;
  cross: number;
  mainSize: number;
  crossSize: number;
}

const sizeOf = <A extends unknown[]>(size: Size | ((...args: A) => Size), ...args: A): Size => (typeof size === "function" ? size(...args) : size);

/** Builds a connector's SVG path between two points, the graph growing in `direction`. */
export function connectorPath(start: Point, end: Point, shape: ConnectorShape = "curve", direction: Direction = "right"): string {
  const { x: x1, y: y1 } = start;
  const { x: x2, y: y2 } = end;
  if (shape === "straight") return `M${x1} ${y1} L${x2} ${y2}`;
  if (direction === "right") {
    const mx = (x1 + x2) / 2;
    return shape === "elbow" ? `M${x1} ${y1} H${mx} V${y2} H${x2}` : `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }
  const my = (y1 + y2) / 2;
  return shape === "elbow" ? `M${x1} ${y1} V${my} H${x2} V${y2}` : `M${x1} ${y1} C${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

export function layout<I extends Id = Id, V = unknown>(options: LayoutOptions<I, V>): Layout<I, V> {
  const { lanes, rootSize, nodeSize, padding = 0, start = 0, direction = "right", shape = "curve", compare } = options;
  const columnGap = options.gap?.column ?? 0;
  const rowGap = options.gap?.row ?? 0;
  const laneGap = options.gap?.lane ?? 0;
  const open = new Set(options.open ?? []);
  const right = direction === "right";
  const box = (size: Size): Pick<Box, "mainSize" | "crossSize"> => (right ? { mainSize: size.width, crossSize: size.height } : { mainSize: size.height, crossSize: size.width });
  const rect = (b: Box): Rect => (right ? { x: b.main, y: b.cross, width: b.mainSize, height: b.crossSize } : { x: b.cross, y: b.main, width: b.crossSize, height: b.mainSize });
  const point = (main: number, cross: number): Point => (right ? { x: main, y: cross } : { x: cross, y: main });

  const placed: PlacedLane<I, V>[] = [];
  let cursor = start;
  let far = 0;
  for (const lane of lanes) {
    const root = lane.root;
    const isOpen = open.has(root);
    const unfolded = isOpen && lane.edges.length > 0;
    const pos = new Map<I, Box>([[root, { main: 0, cross: cursor, ...box(sizeOf(rootSize, root)) }]]);
    const depth = new Map<I, number>([[root, 0]]);
    const order: I[] = [root];
    let bottom = cursor + pos.get(root)!.crossSize;
    far = Math.max(far, pos.get(root)!.mainSize);

    if (unfolded) {
      // breadth first, in the edges' order: a node's depth is its shortest distance from the root
      for (let i = 0; i < order.length; i++) {
        for (const [a, b] of lane.edges) {
          if (a === order[i] && !depth.has(b)) {
            depth.set(b, depth.get(a)! + 1);
            order.push(b);
          }
        }
      }
      const columns: I[][] = [];
      for (const id of order.slice(1)) (columns[depth.get(id)!] ??= []).push(id);
      let mainAt = pos.get(root)!.mainSize + columnGap;
      for (let c = 1; c < columns.length; c++) {
        const ids = columns[c] ?? [];
        const sizes = new Map(ids.map((id) => [id, box(sizeOf(nodeSize, id, c))]));
        const width = Math.max(0, ...[...sizes.values()].map((s) => s.mainSize));
        // each node wants to sit level with its parents (the ones already placed, in earlier columns)
        const want = ids
          .map((id, index) => {
            const at = lane.edges.filter(([a, b]) => b === id && pos.has(a)).map(([a]) => pos.get(a)!.cross);
            return { id, index, cross: at.length ? at.reduce((s, y) => s + y, 0) / at.length : cursor };
          })
          .toSorted((a, b) => a.cross - b.cross || (compare ? compare(a.id, b.id) : a.index - b.index));
        let next = -Infinity;
        for (const w of want) {
          const size = sizes.get(w.id)!;
          const cross = Math.max(w.cross, next, cursor);
          pos.set(w.id, { main: mainAt, cross, ...size });
          next = cross + size.crossSize + rowGap;
          bottom = Math.max(bottom, cross + size.crossSize);
        }
        far = Math.max(far, mainAt + width);
        mainAt += width + columnGap;
      }
    }

    const edges: PlacedEdge<I, V>[] = [];
    if (unfolded) {
      for (const [a, b, via] of lane.edges) {
        const p = pos.get(a);
        const q = pos.get(b);
        if (!p || !q) continue;
        const startPoint = point(p.main + p.mainSize, p.cross + p.crossSize / 2);
        const endPoint = point(q.main, q.cross + q.crossSize / 2);
        edges.push({
          from: a,
          to: b,
          via: via ?? [],
          start: startPoint,
          end: endPoint,
          mid: { x: (startPoint.x + endPoint.x) / 2, y: (startPoint.y + endPoint.y) / 2 },
          path: connectorPath(startPoint, endPoint, shape, direction),
        });
      }
    }

    placed.push({
      root,
      open: isOpen,
      unfolded,
      nodes: order.map((id) => ({ id, depth: depth.get(id)!, rect: rect(pos.get(id)!) })),
      edges,
      ...(unfolded ? { band: { start: cursor - padding, size: bottom - cursor + 2 * padding } } : {}),
    });
    cursor = bottom + (unfolded ? 2 * padding + laneGap : laneGap);
  }

  return right ? { lanes: placed, width: far, height: cursor } : { lanes: placed, width: cursor, height: far };
}
