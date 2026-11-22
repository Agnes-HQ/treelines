import { useMemo } from "react";
import { foldPassThrough, Graph, useGraph, type Edge, type Lane } from "treelines";

/**
 * Which of your dependencies brings in which problem packages: one lane per direct dependency, one open at a time.
 * Packages that only pass a route on fold into a "+N" marker; hovering a package traces its routes. A small version of
 * the dependency graph in Agnes (https://agnes.dev), which is built on treelines.
 */

export interface Pkg {
  name: string;
  /** What is wrong with it, if anything. */
  problem?: string;
}

export function DependencyGraph({ direct, edges, packages }: { direct: string[]; edges: Edge<string>[]; packages: Record<string, Pkg> }) {
  const lanes = useMemo<Lane<string, string>[]>(
    () =>
      direct.map((root) => {
        // the part of the graph below this dependency
        const below = new Set([root]);
        for (let changed = true; changed; ) {
          changed = false;
          for (const [a, b] of edges) {
            if (below.has(a) && !below.has(b)) {
              below.add(b);
              changed = true;
            }
          }
        }
        const own = edges.filter(([a]) => below.has(a));
        return { root, edges: foldPassThrough(own, root, (id) => Boolean(packages[id]?.problem)) };
      }),
    [direct, edges, packages],
  );
  return (
    <Graph.Root lanes={lanes} rootSize={{ width: 220, height: 40 }} nodeSize={{ width: 180, height: 40 }} gap={{ column: 32, row: 8, lane: 8 }} padding={6}>
      <Graph.Canvas>
        <Graph.Bands<string>>{(band) => <div aria-hidden className="absolute -inset-x-2 rounded-xl bg-gray-100" style={{ top: band.start, height: band.size }} />}</Graph.Bands>
        <Graph.Connectors<string, string>
          className="absolute inset-0 overflow-visible"
          pathStyle={(edge) => ({ stroke: edge.state.highlighted ? "#111" : "#999", strokeWidth: edge.state.highlighted ? 2 : 1, opacity: edge.state.dimmed ? 0.2 : 1 })}
        />
        <Graph.Markers<string, string>>
          {(edge) => (
            <span title={edge.via.join(" › ")} className="absolute rounded-full border bg-white px-1.5 text-xs" style={{ left: edge.mid.x, top: edge.mid.y, transform: "translate(-50%, -50%)" }}>
              +{edge.via.length}
            </span>
          )}
        </Graph.Markers>
        <Graph.Nodes<string>>
          {(node) => (
            <Graph.Node
              aria-label={packages[node.id]?.problem ? `${node.id}: ${packages[node.id]!.problem}` : node.id}
              className="rounded-lg border bg-white px-3 text-left text-sm data-[dimmed]:opacity-30"
              style={(state) => ({ borderColor: packages[node.id]?.problem ? "#d03b3b" : undefined, fontWeight: state.root ? 600 : 400 })}
            >
              {packages[node.id]?.name ?? node.id}
            </Graph.Node>
          )}
        </Graph.Nodes>
      </Graph.Canvas>
      <Details packages={packages} />
    </Graph.Root>
  );
}

/** A panel of your own, next to the graph, reading the selection with useGraph(). */
function Details({ packages }: { packages: Record<string, Pkg> }) {
  const { selected } = useGraph<string>();
  if (!selected) return <p>Select a package.</p>;
  const pkg = packages[selected.id];
  return (
    <p>
      <strong>{pkg?.name ?? selected.id}</strong>: {pkg?.problem ?? "no problems of its own"}
    </p>
  );
}
