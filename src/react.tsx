"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type SVGAttributes,
} from "react";
import { onTrace, trace, type Trace } from "./graph";
import { layout as computeLayout, type ConnectorShape, type Direction, type Id, type Lane, type Layout, type PlacedEdge, type PlacedLane, type Rect, type Size } from "./layout";

/**
 * The React parts. Headless: they place your elements and tell them their state, they draw no boxes of their own.
 *
 *   <Graph.Root lanes={lanes} rootSize={…} nodeSize={…}>
 *     <Graph.Canvas>
 *       <Graph.Connectors />
 *       <Graph.Nodes>{(node) => <Graph.Node>{node.id}</Graph.Node>}</Graph.Nodes>
 *     </Graph.Canvas>
 *   </Graph.Root>
 *
 * State reaches the markup as data attributes (data-root, data-expanded, data-selected, data-highlighted, data-dimmed)
 * and through `className`/`style` functions, so it is styled with plain CSS or Tailwind.
 */

/** A node in a lane: the lane's root and the node's id (the same node can sit in several lanes). */
export type Selection<I extends Id = Id> = { lane: I; id: I } | null;

export interface NodeState {
  /** The lane's root itself (it opens and closes the lane). */
  root: boolean;
  /** 0 for a root. */
  depth: number;
  /** A root with something to unfold. */
  expandable: boolean;
  /** A root whose lane is unfolded. */
  expanded: boolean;
  selected: boolean;
  /**
   * On a route through the hovered or focused node (or the selected one, when nothing is hovered). Matched by id, so the
   * same node lights up wherever it appears, as the root of another lane too.
   */
  highlighted: boolean;
  /** Routes are being traced and this node is not on one. */
  dimmed: boolean;
  /** Its size is not known yet (measured sizes only). */
  measuring: boolean;
}

export interface EdgeState {
  highlighted: boolean;
  dimmed: boolean;
}

export interface NodeInfo<I extends Id = Id> {
  lane: I;
  id: I;
  depth: number;
  rect: Rect;
  state: NodeState;
}

export interface EdgeInfo<I extends Id = Id, V = unknown> extends PlacedEdge<I, V> {
  lane: I;
  state: EdgeState;
}

export interface BandInfo<I extends Id = Id> {
  lane: I;
  /** Along the cross axis (y when the graph grows to the right): where the unfolded lane's room starts and how big it is. */
  start: number;
  size: number;
}

type Styled<S> = {
  className?: string | ((state: S) => string | undefined);
  style?: CSSProperties | ((state: S) => CSSProperties | undefined);
};

const resolve = <S, T>(value: T | ((state: S) => T), state: S): T => (typeof value === "function" ? (value as (state: S) => T)(state) : value);

// effects that measure must run before paint in the browser and not at all on the server
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (next: T) => void): [T, (next: T) => void] {
  const [own, setOwn] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : own;
  const set = useCallback(
    (next: T) => {
      if (!controlled) setOwn(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );
  return [current, set];
}

interface GraphContextValue<I extends Id = Id, V = unknown> {
  layout: Layout<I, V>;
  lanes: readonly Lane<I, V>[];
  direction: Direction;
  open: readonly I[];
  selected: Selection<I>;
  traced: { lane: I; trace: Trace<I> } | null;
  measuredRoots: boolean;
  measuredNodes: boolean;
  measuring: boolean;
  keyboardNavigation: boolean;
  nodeState: (lane: I, id: I, depth: number) => NodeState;
  edgeState: (lane: I, edge: PlacedEdge<I, V>) => EdgeState;
  toggleLane: (root: I) => void;
  select: (lane: I, id: I) => void;
  hover: (target: Selection<I>) => void;
  report: (id: I, root: boolean, element: HTMLElement | null) => void;
  register: (key: string, element: HTMLElement | null) => void;
  focusFrom: (lane: I, id: I, key: string) => boolean;
}

const GraphContext = createContext<GraphContextValue | null>(null);
const NodeContext = createContext<NodeInfo | null>(null);

function useGraphContext(part: string): GraphContextValue {
  const ctx = useContext(GraphContext);
  if (!ctx) throw new Error(`treelines: <Graph.${part}> must be inside <Graph.Root>`);
  return ctx;
}

const keyOf = (lane: Id, id: Id) => `${String(lane)}\u0000${String(id)}`;
/** Measured sizes are kept per node id, roots apart from the rest. */
const sizeKey = (id: Id, root: boolean) => `${root ? "r" : "n"}\u0000${String(id)}`;

export interface RootProps<I extends Id = Id, V = unknown> {
  lanes: readonly Lane<I, V>[];
  /** The size of every lane's root. Leave it out to measure each root as you render it. */
  rootSize?: Size | ((id: I) => Size);
  /** The size of the nodes below. Leave it out to measure them. Fixed sizes need no measuring and lay out on the server too. */
  nodeSize?: Size | ((id: I, depth: number) => Size);
  gap?: { column?: number; row?: number; lane?: number };
  /** Room around an unfolded lane (its band). */
  padding?: number;
  /** Where the first lane starts along the cross axis. */
  start?: number;
  direction?: Direction;
  shape?: ConnectorShape;
  /** Breaks ties between nodes that want the same row. */
  compare?: (a: I, b: I) => number;
  /** The unfolded lanes (by root): controlled. */
  open?: readonly I[];
  defaultOpen?: readonly I[];
  onOpenChange?: (open: I[]) => void;
  /** Several lanes open at once. By default opening one closes the other. */
  multiple?: boolean;
  /** The selected node: controlled. */
  selected?: Selection<I>;
  defaultSelected?: Selection<I>;
  onSelectedChange?: (selected: Selection<I>) => void;
  /** Arrow keys move between nodes (and the right arrow unfolds a folded root). On by default. */
  keyboardNavigation?: boolean;
  children?: ReactNode;
}

function Root<I extends Id = Id, V = unknown>(props: RootProps<I, V>) {
  const { lanes, rootSize, nodeSize, gap, padding, start, direction = "right", shape, compare, multiple = false, keyboardNavigation = true, children } = props;
  const [open, setOpen] = useControllable<readonly I[]>(props.open, props.defaultOpen ?? [], props.onOpenChange as ((next: readonly I[]) => void) | undefined);
  const [selected, setSelected] = useControllable<Selection<I>>(props.selected, props.defaultSelected ?? null, props.onSelectedChange);
  const [hovered, setHovered] = useState<Selection<I>>(null);

  // measured sizes, by node id (the same node has the same content in every lane)
  const [sizes, setSizes] = useState<ReadonlyMap<string, Size>>(() => new Map());
  const measuredRoots = rootSize === undefined;
  const measuredNodes = nodeSize === undefined;

  const result = useMemo(
    () =>
      computeLayout<I, V>({
        lanes,
        open,
        rootSize: rootSize ?? ((id: I) => sizes.get(sizeKey(id, true)) ?? { width: 0, height: 0 }),
        nodeSize: nodeSize ?? ((id: I) => sizes.get(sizeKey(id, false)) ?? { width: 0, height: 0 }),
        ...(gap ? { gap } : {}),
        ...(padding !== undefined ? { padding } : {}),
        ...(start !== undefined ? { start } : {}),
        direction,
        ...(shape ? { shape } : {}),
        ...(compare ? { compare } : {}),
      }),
    [lanes, open, rootSize, nodeSize, sizes, gap, padding, start, direction, shape, compare],
  );

  const measuring =
    (measuredRoots || measuredNodes) &&
    result.lanes.some((lane) => lane.nodes.some((n) => (n.depth === 0 ? measuredRoots : measuredNodes) && !sizes.has(sizeKey(n.id, n.depth === 0))));

  const report = useCallback((id: I, root: boolean, element: HTMLElement | null) => {
    if (!element) return;
    const size = { width: element.offsetWidth, height: element.offsetHeight };
    const key = sizeKey(id, root);
    setSizes((current) => {
      const known = current.get(key);
      if (known && known.width === size.width && known.height === size.height) return current;
      return new Map(current).set(key, size);
    });
  }, []);

  // hover (or focus) traces routes; without it, the selection does. Only inside an unfolded lane.
  const active = hovered ?? selected;
  const traced = useMemo(() => {
    if (!active) return null;
    const lane = result.lanes.find((l) => l.root === active.lane);
    if (!lane?.unfolded) return null;
    const edges = lanes.find((l) => l.root === active.lane)?.edges ?? [];
    return { lane: active.lane, trace: trace(edges, active.id) };
  }, [active, result.lanes, lanes]);

  const nodeState = useCallback(
    (lane: I, id: I, depth: number): NodeState => {
      const placed = result.lanes.find((l) => l.root === lane);
      const root = depth === 0;
      const expandable = root && (lanes.find((l) => l.root === lane)?.edges.length ?? 0) > 0;
      // by id: the same node lights up in every lane it appears in
      const highlighted = !!traced && (traced.trace.up.has(id) || traced.trace.down.has(id));
      return {
        root,
        depth,
        expandable,
        expanded: root && !!placed?.unfolded,
        selected: !!selected && selected.lane === lane && selected.id === id,
        highlighted,
        dimmed: !!traced && !highlighted,
        measuring: (root ? measuredRoots : measuredNodes) && !sizes.has(sizeKey(id, root)),
      };
    },
    [result.lanes, lanes, traced, selected, measuredRoots, measuredNodes, sizes],
  );

  const edgeState = useCallback(
    (lane: I, edge: PlacedEdge<I, V>): EdgeState => {
      const highlighted = !!traced && onTrace(traced.trace, [edge.from, edge.to]);
      return { highlighted, dimmed: !!traced && !highlighted };
    },
    [traced],
  );

  const toggleLane = useCallback(
    (root: I) => {
      const expandable = (lanes.find((l) => l.root === root)?.edges.length ?? 0) > 0;
      const isOpen = open.includes(root);
      if (multiple) {
        if (expandable) setOpen(isOpen ? open.filter((r) => r !== root) : [...open, root]);
      } else {
        // one at a time: opening this one closes the other; a root with nothing below closes the open one
        setOpen(isOpen || !expandable ? [] : [root]);
      }
      setSelected({ lane: root, id: root });
      setHovered(null);
    },
    [lanes, open, multiple, setOpen, setSelected],
  );

  const select = useCallback(
    (lane: I, id: I) => setSelected(selected && selected.lane === lane && selected.id === id ? null : { lane, id }),
    [selected, setSelected],
  );

  // keyboard: the elements by key, to move focus between them
  const elements = useRef(new Map<string, HTMLElement>());
  const register = useCallback((key: string, element: HTMLElement | null) => {
    if (element) elements.current.set(key, element);
    else elements.current.delete(key);
  }, []);
  const focusFrom = useCallback(
    (lane: I, id: I, key: string): boolean => {
      // `key` is the arrow, already turned into a direction along the graph: next/previous across, deeper/shallower
      const placed = result.lanes.find((l) => l.root === lane);
      const here = placed?.nodes.find((n) => n.id === id);
      if (!placed || !here) return false;
      const right = direction === "right";
      const main = (r: Rect) => (right ? r.x : r.y);
      const cross = (r: Rect) => (right ? r.y : r.x);
      let target: { lane: I; id: I } | undefined;
      if (key === "next" || key === "previous") {
        const sign = key === "next" ? 1 : -1;
        if (here.depth === 0) {
          // between lanes, root to root
          const at = result.lanes.indexOf(placed);
          const other = result.lanes[at + sign];
          if (other) target = { lane: other.root, id: other.root };
        } else {
          const column = placed.nodes.filter((n) => n.depth === here.depth && sign * (cross(n.rect) - cross(here.rect)) > 0);
          const nearest = column.toSorted((a, b) => sign * (cross(a.rect) - cross(b.rect)))[0];
          if (nearest) target = { lane, id: nearest.id };
        }
      } else {
        const depth = here.depth + (key === "deeper" ? 1 : -1);
        if (key === "deeper" && here.depth === 0 && !placed.unfolded) {
          if ((lanes.find((l) => l.root === lane)?.edges.length ?? 0) > 0) toggleLane(lane);
          return true;
        }
        const column = placed.nodes.filter((n) => n.depth === depth);
        const nearest = column.toSorted((a, b) => Math.abs(cross(a.rect) - cross(here.rect)) - Math.abs(cross(b.rect) - cross(here.rect)) || main(a.rect) - main(b.rect))[0];
        if (nearest) target = { lane, id: nearest.id };
      }
      if (!target) return false;
      elements.current.get(keyOf(target.lane, target.id))?.focus();
      return true;
    },
    [result.lanes, direction, lanes, toggleLane],
  );

  const value = useMemo<GraphContextValue<I, V>>(() => ({
    layout: result,
    lanes,
    direction,
    open,
    selected,
    traced,
    measuredRoots,
    measuredNodes,
    measuring,
    keyboardNavigation,
    nodeState,
    edgeState,
    toggleLane,
    select,
    hover: setHovered,
    report,
    register,
    focusFrom,
  }), [result, lanes, direction, open, selected, traced, measuredRoots, measuredNodes, measuring, keyboardNavigation, nodeState, edgeState, toggleLane, select, report, register, focusFrom]);
  return <GraphContext.Provider value={value as unknown as GraphContextValue}>{children}</GraphContext.Provider>;
}

export interface CanvasProps extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "style">, Styled<{ width: number; height: number; measuring: boolean }> {}

/** The area the graph is drawn in: positioned, and as big as the layout. Hidden while measured sizes are still unknown. */
function Canvas({ className, style, children, ...rest }: CanvasProps) {
  const ctx = useGraphContext("Canvas");
  const state = { width: ctx.layout.width, height: ctx.layout.height, measuring: ctx.measuring };
  return (
    <div
      {...rest}
      data-measuring={ctx.measuring ? "" : undefined}
      className={resolve(className, state)}
      style={{ position: "relative", width: state.width, height: state.height, ...(ctx.measuring ? { visibility: "hidden" } : {}), ...resolve(style, state) }}
    >
      {children}
    </div>
  );
}

/** One element per unfolded lane, for a background behind it: you render it, with the band's place along the cross axis. */
function Bands<I extends Id = Id>({ children }: { children: (band: BandInfo<I>) => ReactNode }) {
  const ctx = useGraphContext("Bands");
  return (
    <>
      {ctx.layout.lanes.flatMap((lane: PlacedLane) =>
        lane.band ? [<BandSlot key={keyOf(lane.root, "band")}>{children({ lane: lane.root as I, start: lane.band.start, size: lane.band.size })}</BandSlot>] : [],
      )}
    </>
  );
}
const BandSlot = ({ children }: { children: ReactNode }) => <>{children}</>;

export interface ConnectorsProps<I extends Id = Id, V = unknown> extends Omit<SVGAttributes<SVGSVGElement>, "children"> {
  /** Class or style per connector, from its state; or render each connector yourself. */
  pathClassName?: string | ((edge: EdgeInfo<I, V>) => string | undefined);
  pathStyle?: CSSProperties | ((edge: EdgeInfo<I, V>) => CSSProperties | undefined);
  children?: (edge: EdgeInfo<I, V>) => ReactNode;
}

/** The connector lines, as SVG paths in one SVG over the canvas. Decorative: hidden from assistive technology. */
function Connectors<I extends Id = Id, V = unknown>({ pathClassName, pathStyle, children, ...rest }: ConnectorsProps<I, V>) {
  const ctx = useGraphContext("Connectors");
  const edges = useEdges<I, V>();
  return (
    <svg aria-hidden width={ctx.layout.width} height={ctx.layout.height} {...rest}>
      {edges.map((edge) =>
        children ? (
          <EdgeSlot key={keyOf(edge.lane, `${String(edge.from)}>${String(edge.to)}`)}>{children(edge)}</EdgeSlot>
        ) : (
          <path
            key={keyOf(edge.lane, `${String(edge.from)}>${String(edge.to)}`)}
            d={edge.path}
            fill="none"
            data-highlighted={edge.state.highlighted ? "" : undefined}
            data-dimmed={edge.state.dimmed ? "" : undefined}
            className={resolve(pathClassName, edge)}
            style={resolve(pathStyle, edge)}
          />
        ),
      )}
    </svg>
  );
}
const EdgeSlot = ({ children }: { children: ReactNode }) => <>{children}</>;

function useEdges<I extends Id = Id, V = unknown>(): EdgeInfo<I, V>[] {
  const ctx = useGraphContext("Connectors");
  return ctx.layout.lanes.flatMap((lane: PlacedLane) => lane.edges.map((edge) => ({ ...edge, lane: lane.root, state: ctx.edgeState(lane.root, edge) }))) as unknown as EdgeInfo<I, V>[];
}

/** One element per connector with folded nodes in it ("+N"): you render it, at `edge.mid`. */
function Markers<I extends Id = Id, V = unknown>({ children }: { children: (edge: EdgeInfo<I, V>) => ReactNode }) {
  const edges = useEdges<I, V>();
  return <>{edges.filter((edge) => edge.via.length > 0).map((edge) => <EdgeSlot key={keyOf(edge.lane, `${String(edge.from)}>${String(edge.to)}`)}>{children(edge)}</EdgeSlot>)}</>;
}

/** Every node, root first then the nodes below in reading order, lane by lane. Render each with <Graph.Node>. */
function Nodes<I extends Id = Id>({ children }: { children: (node: NodeInfo<I>) => ReactNode }) {
  const ctx = useGraphContext("Nodes");
  return (
    <>
      {ctx.layout.lanes.flatMap((lane: PlacedLane) =>
        lane.nodes.map((n) => {
          const info: NodeInfo = { lane: lane.root, id: n.id, depth: n.depth, rect: n.rect, state: ctx.nodeState(lane.root, n.id, n.depth) };
          return <NodeSlot key={keyOf(lane.root, n.id)} info={info} render={children as (node: NodeInfo) => ReactNode} />;
        }),
      )}
    </>
  );
}

/** What <Graph.Node> puts on its element: your props, the position, the state's data attributes and the handlers. */
/** Gives a node's info to the <Graph.Node> inside it; the value only changes when the node does. */
function NodeSlot({ info, render }: { info: NodeInfo; render: (node: NodeInfo) => ReactNode }) {
  const { lane, id, depth, rect, state } = info;
  const value = useMemo(
    () => ({ lane, id, depth, rect, state }),
    // a new object only when something in it changed
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [lane, id, depth, rect.x, rect.y, rect.width, rect.height, state.root, state.expandable, state.expanded, state.selected, state.highlighted, state.dimmed, state.measuring],
  );
  return <NodeContext.Provider value={value}>{render(value)}</NodeContext.Provider>;
}

type NodeElementProps = HTMLAttributes<HTMLElement> & Record<`data-${string}`, string | undefined>;

export interface NodeProps extends Omit<HTMLAttributes<HTMLButtonElement>, "className" | "style">, Styled<NodeState> {
  /** Another element instead of the button, or a function that renders one with the props it gets. */
  render?: ReactElement | ((props: NodeElementProps & { ref: (el: HTMLElement | null) => void }, state: NodeState) => ReactElement);
}

/**
 * A node: a button by default, placed where the layout puts it. A root opens and closes its lane (and is selected); a
 * node below toggles its selection. Hover and focus trace its routes. Your handlers run first; `event.preventDefault()`
 * in one skips the graph's own.
 */
function Node({ render, className, style, onClick, onMouseEnter, onMouseLeave, onFocus, onBlur, onKeyDown, children, ...rest }: NodeProps) {
  const ctx = useGraphContext("Node");
  const node = useContext(NodeContext);
  if (!node) throw new Error("treelines: <Graph.Node> must be rendered from <Graph.Nodes>");
  const { lane, id, rect, state } = node;
  const key = keyOf(lane, id);
  const measured = state.root ? ctx.measuredRoots : ctx.measuredNodes;

  const { register, report } = ctx;
  const [element, setElement] = useState<HTMLElement | null>(null);
  const ref = useCallback(
    (el: HTMLElement | null) => {
      setElement(el);
      register(key, el);
    },
    [key, register],
  );
  // measured sizes: read the element's own size before paint, and again whenever it changes
  const root = state.root;
  useIsomorphicLayoutEffect(() => {
    if (!measured || !element) return;
    report(id, root, element);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => report(id, root, element));
    observer.observe(element);
    return () => observer.disconnect();
  }, [measured, element, id, root, report]);

  const position: CSSProperties = measured
    ? { position: "absolute", left: rect.x, top: rect.y }
    : { position: "absolute", left: rect.x, top: rect.y, width: rect.width, height: rect.height };

  const props: NodeElementProps = {
    ...rest,
    "data-root": state.root ? "" : undefined,
    "data-expanded": state.expanded ? "" : undefined,
    "data-selected": state.selected ? "" : undefined,
    "data-highlighted": state.highlighted ? "" : undefined,
    "data-dimmed": state.dimmed ? "" : undefined,
    "data-depth": String(state.depth),
    ...(state.root ? { "aria-expanded": state.expandable ? state.expanded : undefined } : { "aria-pressed": state.selected }),
    className: resolve(className, state),
    style: { ...position, ...resolve(style, state) },
    onClick: (event: MouseEvent<HTMLElement>) => {
      onClick?.(event as MouseEvent<HTMLButtonElement>);
      if (event.defaultPrevented) return;
      if (state.root) ctx.toggleLane(lane);
      else ctx.select(lane, id);
    },
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      onMouseEnter?.(event as MouseEvent<HTMLButtonElement>);
      if (!event.defaultPrevented) ctx.hover({ lane, id });
    },
    onMouseLeave: (event: MouseEvent<HTMLElement>) => {
      onMouseLeave?.(event as MouseEvent<HTMLButtonElement>);
      if (!event.defaultPrevented) ctx.hover(null);
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      onFocus?.(event as FocusEvent<HTMLButtonElement>);
      if (!event.defaultPrevented) ctx.hover({ lane, id });
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      onBlur?.(event as FocusEvent<HTMLButtonElement>);
      if (!event.defaultPrevented) ctx.hover(null);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      onKeyDown?.(event as KeyboardEvent<HTMLButtonElement>);
      if (event.defaultPrevented || !ctx.keyboardNavigation) return;
      const right = ctx.direction === "right";
      const move = { ArrowDown: right ? "next" : "deeper", ArrowUp: right ? "previous" : "shallower", ArrowRight: right ? "deeper" : "next", ArrowLeft: right ? "shallower" : "previous" }[event.key];
      if (move && ctx.focusFrom(lane, id, move)) event.preventDefault();
    },
  };

  if (typeof render === "function") return render({ ...props, ref }, state);
  if (isValidElement(render)) return cloneElement(render, { ...props, ref } as Record<string, unknown>, children ?? (render.props as { children?: ReactNode }).children);
  return (
    <button type="button" {...(props as HTMLAttributes<HTMLButtonElement>)} ref={ref}>
      {children}
    </button>
  );
}

/** The graph's state, for parts of your own: a details panel, a "show more", a legend. */
export function useGraph<I extends Id = Id>() {
  const ctx = useGraphContext("useGraph") as unknown as GraphContextValue<I>;
  return {
    layout: ctx.layout,
    open: ctx.open,
    selected: ctx.selected,
    /** The routes being traced, and in which lane. */
    traced: ctx.traced,
    measuring: ctx.measuring,
    toggleLane: ctx.toggleLane,
    select: ctx.select,
  };
}

/** The node a <Graph.Node> renders, for components inside it. */
export function useNode(): NodeInfo {
  const node = useContext(NodeContext);
  if (!node) throw new Error("treelines: useNode() must be used inside <Graph.Nodes>");
  return node;
}

export const Graph = { Root, Canvas, Bands, Connectors, Markers, Nodes, Node };
