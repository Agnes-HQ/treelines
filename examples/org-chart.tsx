import { useMemo } from "react";
import { fromTree, Graph } from "treelines";

/** An org chart from nested JSON: growing downwards, right-angled connectors, fixed card sizes. */

export interface Person {
  id: string;
  name: string;
  role: string;
  reports?: Person[];
}

export function OrgChart({ ceo }: { ceo: Person }) {
  const { lanes, nodes } = useMemo(() => fromTree([ceo], (p) => p.id, (p) => p.reports), [ceo]);
  return (
    <Graph.Root lanes={lanes} direction="down" shape="elbow" rootSize={{ width: 200, height: 64 }} nodeSize={{ width: 200, height: 64 }} gap={{ column: 40, row: 16 }} defaultOpen={[ceo.id]}>
      <Graph.Canvas className="mx-auto">
        <Graph.Connectors className="absolute inset-0 overflow-visible" pathClassName="stroke-gray-300 data-[highlighted]:stroke-gray-900" />
        <Graph.Nodes<string>>
          {(node) => {
            const person = nodes.get(node.id)!;
            return (
              <Graph.Node className="rounded-lg border bg-white px-3 py-2 text-left shadow-sm data-[dimmed]:opacity-40 data-[selected]:ring-2 data-[selected]:ring-blue-500">
                <span className="block font-medium">{person.name}</span>
                <span className="block text-sm text-gray-500">{person.role}</span>
              </Graph.Node>
            );
          }}
        </Graph.Nodes>
      </Graph.Canvas>
    </Graph.Root>
  );
}
