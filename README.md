<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark.svg">
    <img src="./assets/logo-light.svg" alt="treelines" width="227" height="64">
  </picture>
</h1>

Headless layout, connector lines and behaviour for trees and layered graphs in React. **You render the nodes.**

Give it nested data, or nodes and edges, and render each node as whatever element you like. treelines places them in
columns, draws the lines between them and handles unfolding, selection, route tracing and the keyboard. It has no styles
and no cards of its own: state reaches your markup as data attributes, so you style it with plain CSS or Tailwind.

- **Your elements, in the page:** ordinary DOM nodes in the document flow, not a canvas. No pan and zoom, no `foreignObject`.
- **Layered layout:** a node's column is its distance from the root, and its row follows its parents. Trees and
  graphs with shared nodes both work.
- **Connectors:** SVG paths, curved, right-angled or straight, or drawn by you. Chains of pass-through nodes can fold into a "+N".
- **Behaviour:** unfold one lane at a time (or several), select, trace a node's routes on hover or focus, and move with the arrow keys.
- **Fixed or measured sizes:** fixed sizes lay out on the server too; measured ones adapt to whatever you render.
- **Small:** no runtime dependencies, React 18 and 19, MIT.

**[Live demo](https://agnes-hq.github.io/treelines/)**: a dependency graph, an org chart and a file tree, styled with
plain CSS.

It powers the dependency graph in [Agnes](https://agnes.dev), which shows which of a repository's dependencies bring in
vulnerable, outdated or deprecated packages.

## Install

```sh
npm install treelines
```

## Quick start

```tsx
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
```

The type argument on `Graph.Nodes` (and `Graph.Connectors`, `Graph.Markers`, `Graph.Bands`) is the type of your ids.
This code is [`examples/quick-start.tsx`](./examples/quick-start.tsx).

## How it lays things out

The data is a list of **lanes**. Each lane is a **root** and the graph that unfolds from it, given as edges
`[from, to]`. Lanes stack along the cross axis. A folded lane shows only its root; an unfolded lane shows its graph beside
it, in columns by depth.

```
lane "app"   ──┬── core ──── util      (unfolded)
               └── ui
lane "lint"                           (folded: just its root)
```

`fromTree(roots, getId, getChildren)` turns nested data into lanes: one lane per top-level item. If the same id appears
twice, it is one shared node, so data with shared children works too. You can also build lanes yourself, for example
one per direct dependency with only the routes you care about.

## API

### `<Graph.Root>`

| Prop | | |
|---|---|---|
| `lanes` | `Lane[]` | `{ root, edges }` per lane; an edge is `[from, to]` or `[from, to, via]` |
| `rootSize`, `nodeSize` | `Size \| (id, depth) => Size` | Leave one out to **measure** those nodes instead. Fixed sizes need no measuring and also lay out on the server. |
| `gap` | `{ column, row, lane }` | Pixels between columns, between nodes in a column, and between lanes |
| `padding` | `number` | Room around an unfolded lane (its band) |
| `start` | `number` | Where the first lane starts |
| `direction` | `"right" \| "down"` | Which way graphs grow (default `"right"`) |
| `shape` | `"curve" \| "elbow" \| "straight"` | The connector shape (default `"curve"`) |
| `compare` | `(a, b) => number` | Breaks ties between nodes that want the same row (default: first seen first) |
| `open`, `defaultOpen`, `onOpenChange` | `Id[]` | The unfolded lanes, by root; controlled or not |
| `multiple` | `boolean` | Several lanes open at once. By default, opening one closes the other. |
| `selected`, `defaultSelected`, `onSelectedChange` | `{ lane, id } \| null` | The selected node; controlled or not |
| `keyboardNavigation` | `boolean` | Arrow keys between nodes; the right arrow unfolds a folded root (default `true`) |

### Parts

- **`<Graph.Canvas>`**: the positioned area, as big as the layout. While measured sizes are still unknown it is
  hidden and carries `data-measuring`. `className` and `style` may be functions of `{ width, height, measuring }`.
- **`<Graph.Connectors>`**: one SVG over the canvas with a `<path>` per connector, marked `data-highlighted` or
  `data-dimmed`. Use `pathClassName` or `pathStyle` as functions of the edge, or render each connector yourself with
  `{(edge) => …}`. The SVG is decorative and hidden from assistive technology.
- **`<Graph.Markers>`**: `{(edge) => …}` for every connector with folded nodes in it; place it at `edge.mid`.
- **`<Graph.Bands>`**: `{(band) => …}` for every unfolded lane: `band.start` and `band.size` along the cross axis, for
  a background behind it.
- **`<Graph.Nodes>`**: `{(node) => …}` for every node in reading order (the root, then breadth first).
  `node` has `lane`, `id`, `depth`, `rect` and `state`.
- **`<Graph.Node>`**: renders a `<button>` (or your own element via `render`) where the layout puts it.
  - Clicking a root opens and closes its lane and selects it. Clicking a node below toggles its selection.
  - Hover and focus trace its routes.
  - Your own handlers run first; call `event.preventDefault()` to skip the graph's.

### State on your elements

| Attribute | On | Meaning |
|---|---|---|
| `data-root` | nodes | The lane's root |
| `data-expanded` | roots | The lane is unfolded (`aria-expanded` too, when there is something to unfold) |
| `data-selected` | nodes | The selected node (`aria-pressed` on nodes below a root) |
| `data-highlighted` | nodes, paths | On a route through the hovered or focused node, or the selected one when nothing is hovered. Matched by id, so the same node lights up wherever it appears. |
| `data-dimmed` | nodes, paths | Routes are being traced and this is not on one |
| `data-depth` | nodes | 0 for a root |
| `data-measuring` | canvas | Sizes are still being measured |

`className` and `style` on `<Graph.Node>` also take a function of the same state.

### Hooks

- **`useGraph()`**: `{ layout, open, selected, traced, measuring, toggleLane, select }`, for parts of your own such as a
  details panel or a legend.
- **`useNode()`**: the node a `<Graph.Node>` renders, for components inside it.

### Without React: `treelines/core`

The layout alone, for the server or other frameworks:

- `layout(options)` returns rects, connector paths, marker points, bands and the overall size. Same options as
  `<Graph.Root>`, plus `open`.
- `connectorPath(start, end, shape, direction)` builds one SVG path.
- `trace(edges, id)` and `onTrace(trace, edge)` find the routes through a node.
- `foldPassThrough(edges, root, keep)` folds nodes with one parent and one child into the edge around them, listed in
  its `via`.
- `fromTree(roots, getId, getChildren)` turns nested data into lanes.

## Examples

In [`examples/`](./examples):

- **[Org chart](./examples/org-chart.tsx):** nested data, growing downwards, right-angled connectors.
- **[File tree](./examples/file-tree.tsx):** measured sizes, several folders open at once, a band behind each.
- **[Dependency graph](./examples/dependency-graph.tsx):** a lane per direct dependency, pass-through packages folded
  into "+N", route tracing, and a details panel through `useGraph()`.

## Accessibility

- Nodes are buttons by default, so they are focusable and work with Enter and Space.
- Roots say whether they are expanded; nodes below say whether they are selected.
- Give each node an `aria-label` when its visible text doesn't say enough.
- The connectors are hidden from assistive technology: describe the relationships in your labels or a details panel.
- Arrow-key navigation can be turned off with `keyboardNavigation={false}` if your page already handles the keys.

## When not to use it

For editing graphs, dragging nodes, or a pan-and-zoom canvas with thousands of nodes, use
[React Flow](https://reactflow.dev). treelines is for read-only views inside the page where you want your own
markup and styling.

## Licence

MIT © [Agnes](https://agnes.dev)
