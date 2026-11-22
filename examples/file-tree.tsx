import { useMemo } from "react";
import { fromTree, Graph } from "treelines";

/**
 * A file tree as columns: every top-level folder is a lane you can unfold. No sizes are given, so each node is measured
 * as rendered (the canvas stays hidden until they all are). Several folders can be open at once.
 */

export interface Entry {
  path: string;
  name: string;
  children?: Entry[];
}

export function FileTree({ folders }: { folders: Entry[] }) {
  const { lanes, nodes } = useMemo(() => fromTree(folders, (e) => e.path, (e) => e.children), [folders]);
  return (
    <Graph.Root lanes={lanes} gap={{ column: 24, row: 4, lane: 8 }} padding={4} multiple>
      <Graph.Canvas>
        <Graph.Bands<string>>{(band) => <div aria-hidden className="absolute -inset-x-1 rounded-md bg-gray-50" style={{ top: band.start, height: band.size }} />}</Graph.Bands>
        <Graph.Connectors className="absolute inset-0 overflow-visible" pathClassName="stroke-gray-300" />
        <Graph.Nodes<string>>
          {(node) => (
            <Graph.Node className="whitespace-nowrap rounded px-2 py-1 font-mono text-sm hover:bg-gray-100 data-[expanded]:font-semibold data-[selected]:bg-blue-50">
              {nodes.get(node.id)!.name}
              {nodes.get(node.id)!.children ? "/" : ""}
            </Graph.Node>
          )}
        </Graph.Nodes>
      </Graph.Canvas>
    </Graph.Root>
  );
}
