import { useMemo } from "react";
import { foldPassThrough, Graph, useGraph, type Edge, type Lane } from "treelines";

/**
 * One lane per direct dependency of a (made-up) app. Opening one shows the routes to the packages it brings in that
 * have a problem; packages that only pass a route on fold into "+N". Hover traces, select shows details.
 */

type Problem = { kind: "Vulnerable" | "Deprecated" | "Outdated"; severity: "error" | "warning"; text: string };

const DIRECT = ["ui-kit", "date-picker", "charts", "build-tool"];

const EDGES: Edge<string>[] = [
  // ui-kit: icon-set branches to two problems; popover only passes a route on
  ["ui-kit", "icon-set"], ["icon-set", "svg-reader"], ["svg-reader", "tiny-xml"], ["icon-set", "color-parse"],
  ["ui-kit", "popover"], ["popover", "position-core"], ["position-core", "old-glob"],
  ["date-picker", "time-utils"], ["time-utils", "old-glob"], ["date-picker", "locale-data"],
  ["charts", "color-parse"], ["charts", "svg-reader"],
  ["build-tool", "file-walk"], ["file-walk", "dir-scan"], ["dir-scan", "old-glob"], ["build-tool", "minify-lite"],
];

const PROBLEMS: Record<string, Problem> = {
  "tiny-xml": { kind: "Vulnerable", severity: "error", text: "Parses external entities by default (sample advisory). Fixed in 2.4.1." },
  "old-glob": { kind: "Deprecated", severity: "warning", text: "No longer maintained; its author points to a successor." },
  "color-parse": { kind: "Outdated", severity: "warning", text: "Two major versions behind the latest release." },
  "minify-lite": { kind: "Vulnerable", severity: "warning", text: "Slow on crafted input (sample advisory). Fixed in 1.9.0." },
};

/** Everything below `root`, cut to the routes that end in a package with a problem, pass-through packages folded. */
function laneFor(root: string): Lane<string, string> {
  const below = new Set([root]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const [a, b] of EDGES) {
      if (below.has(a) && !below.has(b)) {
        below.add(b);
        changed = true;
      }
    }
  }
  // keep only nodes that lead to a problem
  const leads = new Set<string>(Object.keys(PROBLEMS).filter((p) => below.has(p)));
  for (let changed = true; changed; ) {
    changed = false;
    for (const [a, b] of EDGES) {
      if (below.has(a) && leads.has(b) && !leads.has(a)) {
        leads.add(a);
        changed = true;
      }
    }
  }
  const own = EDGES.filter(([a, b]) => below.has(a) && leads.has(b) && (a === root || leads.has(a)));
  return { root, edges: foldPassThrough(own, root, (id) => id in PROBLEMS) };
}

function Details() {
  const { selected } = useGraph<string>();
  if (!selected) return <p className="panel-empty">Select a package to see what is wrong with it.</p>;
  const problem = PROBLEMS[selected.id];
  return (
    <div>
      <h3 className="panel-title">{selected.id}</h3>
      <p className="panel-meta">{selected.id === selected.lane ? "A direct dependency" : `Brought in by ${selected.lane}`}</p>
      {problem ? (
        <p className="panel-problem" data-severity={problem.severity}>
          <strong>{problem.kind}.</strong> {problem.text}
        </p>
      ) : (
        <p className="panel-meta">No problems of its own.</p>
      )}
    </div>
  );
}

export function DependencyDemo() {
  const lanes = useMemo(() => DIRECT.map(laneFor), []);
  return (
    <Graph.Root lanes={lanes} rootSize={{ width: 150, height: 44 }} nodeSize={{ width: 150, height: 44 }} gap={{ column: 40, row: 8, lane: 8 }} padding={6} start={6} defaultOpen={["ui-kit"]}>
      <div className="split">
        <div className="scroll">
          <Graph.Canvas className="canvas" style={({ width, height }) => ({ width: width + 12, height })}>
            <Graph.Bands<string>>{(band) => <div aria-hidden className="band" style={{ top: band.start, height: band.size }} />}</Graph.Bands>
            <Graph.Connectors className="lines" />
            <Graph.Markers<string, string>>
              {(edge) => (
                <span className="marker" title={`${edge.via.join(" › ")}: no problems of their own`} data-dimmed={edge.state.dimmed ? "" : undefined} style={{ left: edge.mid.x, top: edge.mid.y }}>
                  +{edge.via.length}
                </span>
              )}
            </Graph.Markers>
            <Graph.Nodes<string>>
              {(node) => {
                const problem = PROBLEMS[node.id];
                return (
                  <Graph.Node
                    className={node.state.root ? "node" : "node node-stack"}
                    data-severity={problem?.severity}
                    aria-label={problem ? `${node.id}: ${problem.kind.toLowerCase()}` : node.id}
                  >
                    {node.state.root && <span className="chevron" aria-hidden="true" />}
                    <span className="node-name">{node.id}</span>
                    {!node.state.root && <span className="node-sub">{problem ? problem.kind : "passes it on"}</span>}
                  </Graph.Node>
                );
              }}
            </Graph.Nodes>
          </Graph.Canvas>
        </div>
        <aside className="panel" aria-label="Package details">
          <Details />
        </aside>
      </div>
    </Graph.Root>
  );
}
