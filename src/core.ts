/**
 * treelines: the layout, the connector lines and the behaviour for trees and layered graphs. You render the nodes.
 *
 * The core, without React (also for the server): `layout` places nodes and connectors, `trace` finds the routes through a node,
 * `foldPassThrough` folds nodes that only pass a route on, `fromTree` turns nested data into lanes.
 */
export { connectorPath, layout } from "./layout";
export type { ConnectorShape, Direction, Edge, Id, Lane, Layout, LayoutOptions, PlacedEdge, PlacedLane, PlacedNode, Point, Rect, Size } from "./layout";
export { foldPassThrough, fromTree, onTrace, trace } from "./graph";
export type { Trace } from "./graph";
