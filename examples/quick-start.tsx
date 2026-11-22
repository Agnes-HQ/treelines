/** The README's quick start, word for word: keep the two the same. */
import { fromTree, Graph } from "treelines";

type Person = { id: string; name: string; reports?: Person[] };

const team: Person = { id: "ada", name: "Ada", reports: [{ id: "bo", name: "Bo" }, { id: "cy", name: "Cy" }] };
const { lanes, nodes } = fromTree([team], (p) => p.id, (p) => p.reports);

export function Team() {
  return (
    <Graph.Root lanes={lanes} rootSize={{ width: 160, height: 48 }} nodeSize={{ width: 160, height: 48 }} gap={{ column: 40, row: 12 }} defaultOpen={["ada"]}>
      <Graph.Canvas>
        <Graph.Connectors className="absolute inset-0 overflow-visible" pathClassName="stroke-gray-300 data-[highlighted]:stroke-black" />
        <Graph.Nodes<string>>
          {(node) => (
            <Graph.Node className="rounded-lg border bg-white px-3 data-[dimmed]:opacity-40 data-[selected]:ring-2">
              {nodes.get(node.id)!.name}
            </Graph.Node>
          )}
        </Graph.Nodes>
      </Graph.Canvas>
    </Graph.Root>
  );
}
