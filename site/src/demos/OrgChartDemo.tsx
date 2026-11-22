import { useMemo } from "react";
import { fromTree, Graph } from "treelines";

/** Nested data, growing downwards, with right-angled connectors. One lane: the whole organisation. */

interface Person {
  id: string;
  name: string;
  role: string;
  reports?: Person[];
}

const TEAM: Person = {
  id: "ada",
  name: "Ada",
  role: "Founder",
  reports: [
    { id: "bo", name: "Bo", role: "Engineering", reports: [{ id: "cy", name: "Cy", role: "Frontend" }, { id: "di", name: "Di", role: "Platform" }] },
    { id: "ed", name: "Ed", role: "Design", reports: [{ id: "fay", name: "Fay", role: "Product design" }] },
    { id: "gus", name: "Gus", role: "Operations" },
  ],
};

export function OrgChartDemo() {
  const { lanes, nodes } = useMemo(() => fromTree([TEAM], (p) => p.id, (p) => p.reports), []);
  return (
    <div className="scroll">
      <Graph.Root lanes={lanes} direction="down" shape="elbow" rootSize={{ width: 150, height: 56 }} nodeSize={{ width: 150, height: 56 }} gap={{ column: 32, row: 14 }} defaultOpen={["ada"]} start={4}>
        <Graph.Canvas className="canvas canvas-center" style={({ width, height }) => ({ width: width + 8, height: height + 4 })}>
          <Graph.Connectors className="lines" />
          <Graph.Nodes<string>>
            {(node) => {
              const person = nodes.get(node.id)!;
              return (
                <Graph.Node className="node node-person" aria-label={`${person.name}, ${person.role}`}>
                  <span className="node-name">{person.name}</span>
                  <span className="node-sub">{person.role}</span>
                </Graph.Node>
              );
            }}
          </Graph.Nodes>
        </Graph.Canvas>
      </Graph.Root>
    </div>
  );
}
