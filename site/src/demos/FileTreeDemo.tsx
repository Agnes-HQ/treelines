import { useMemo } from "react";
import { fromTree, Graph } from "treelines";

/** Every top-level folder is a lane. No sizes are given, so each node is measured as rendered; several can be open. */

interface Entry {
  path: string;
  name: string;
  note?: string;
  children?: Entry[];
}

const FOLDERS: Entry[] = [
  {
    path: "src",
    name: "src",
    children: [
      { path: "src/layout.ts", name: "layout.ts", note: "columns, rows, connector paths" },
      { path: "src/graph.ts", name: "graph.ts", note: "trace, fold, fromTree" },
      { path: "src/react.tsx", name: "react.tsx", note: "the React parts" },
    ],
  },
  {
    path: "examples",
    name: "examples",
    children: [
      { path: "examples/org-chart.tsx", name: "org-chart.tsx" },
      { path: "examples/file-tree.tsx", name: "file-tree.tsx" },
      { path: "examples/dependency-graph.tsx", name: "dependency-graph.tsx" },
    ],
  },
  { path: "test", name: "test", children: [{ path: "test/layout.test.ts", name: "layout.test.ts" }, { path: "test/react.test.tsx", name: "react.test.tsx" }] },
];

export function FileTreeDemo() {
  const { lanes, nodes } = useMemo(() => fromTree(FOLDERS, (e) => e.path, (e) => e.children), []);
  return (
    <div className="scroll">
      <Graph.Root lanes={lanes} gap={{ column: 28, row: 6, lane: 8 }} padding={5} start={5} multiple defaultOpen={["src"]}>
        <Graph.Canvas className="canvas" style={({ width, height }) => ({ width: width + 12, height })}>
          <Graph.Bands<string>>{(band) => <div aria-hidden className="band" style={{ top: band.start, height: band.size }} />}</Graph.Bands>
          <Graph.Connectors className="lines" />
          <Graph.Nodes<string>>
            {(node) => {
              const entry = nodes.get(node.id)!;
              return (
                <Graph.Node className="node node-file">
                  <span className="node-name mono">
                    {entry.name}
                    {entry.children ? "/" : ""}
                  </span>
                  {entry.note && <span className="node-sub">{entry.note}</span>}
                </Graph.Node>
              );
            }}
          </Graph.Nodes>
        </Graph.Canvas>
      </Graph.Root>
    </div>
  );
}
