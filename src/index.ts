/**
 * treelines: the layout, the connector lines and the behaviour for trees and layered graphs, in React. You render the
 * nodes. `treelines/core` has the layout alone, without React.
 */
export * from "./core";
export { Graph, useGraph, useNode } from "./react";
export type { BandInfo, CanvasProps, ConnectorsProps, EdgeInfo, EdgeState, NodeInfo, NodeProps, NodeState, RootProps, Selection } from "./react";
