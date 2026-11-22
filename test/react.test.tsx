// @vitest-environment happy-dom
import { afterEach, beforeAll, expect, test } from "vitest";
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root as ReactRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { Graph, useGraph, type Lane, type RootProps, type Selection } from "../src";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** a > b, a > c, b > d, c > d; x has nothing below; y > z */
const lanes: Lane<string, string>[] = [
  { root: "a", edges: [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"]] },
  { root: "x", edges: [] },
  { root: "y", edges: [["y", "z", ["hidden"]]] },
];

function Demo(props: Partial<RootProps<string, string>> & { node?: (id: string) => ReactNode }) {
  return (
    <Graph.Root lanes={lanes} rootSize={{ width: 100, height: 30 }} nodeSize={{ width: 50, height: 20 }} gap={{ column: 10, row: 5, lane: 4 }} padding={2} {...props}>
      <Graph.Canvas data-testid="canvas">
        <Graph.Bands<string>>{(band) => <div data-band={band.lane} style={{ top: band.start, height: band.size }} />}</Graph.Bands>
        <Graph.Connectors<string, string> pathClassName={(e) => (e.state.highlighted ? "on" : e.state.dimmed ? "off" : undefined)} />
        <Graph.Markers<string, string>>{(e) => <span data-marker={`${e.from}>${e.to}`}>+{e.via.length}</span>}</Graph.Markers>
        <Graph.Nodes<string>>{(n) => <Graph.Node data-id={n.id} className={(s) => (s.selected ? "is-selected" : undefined)}>{props.node ? props.node(n.id) : n.id}</Graph.Node>}</Graph.Nodes>
      </Graph.Canvas>
    </Graph.Root>
  );
}

let mounted: { el: HTMLElement; root: ReactRoot } | null = null;
function mount(ui: ReactNode) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(ui));
  mounted = { el, root };
  return el;
}
afterEach(() => {
  if (!mounted) return;
  const { el, root } = mounted;
  act(() => root.unmount());
  el.remove();
  mounted = null;
});

const node = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`[data-id="${id}"]`)!;
const click = (target: HTMLElement) => act(() => target.click());
const fire = (target: HTMLElement, type: string, init: EventInit & { key?: string } = {}) =>
  act(() => {
    const event = type.startsWith("key") ? new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }) : new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
  });

test("renders on the server, laid out: positioned nodes, connectors, a band, the state as attributes", () => {
  const html = renderToStaticMarkup(<Demo defaultOpen={["a"]} />);
  expect(html).toContain('data-id="a"');
  expect(html).toMatch(/data-id="d"[^>]*style="position:absolute;left:170px;top:12.5px;width:50px;height:20px"/);
  expect(html).toMatch(/aria-expanded="true"[^>]*data-id="a"|data-id="a"[^>]*aria-expanded="true"/);
  expect(html.match(/<path /g)).toHaveLength(4);
  expect(html).toContain('data-band="a"');
  // x has nothing to unfold: no aria-expanded at all
  expect(html).not.toMatch(/data-id="x"[^>]*aria-expanded/);
  expect(html).not.toContain("data-measuring");
});

test("one lane open at a time; a root with nothing below closes the open one; roots are selected when clicked", () => {
  const el = mount(<Demo />);
  expect(node(el, "a").getAttribute("aria-expanded")).toBe("false");
  click(node(el, "a"));
  expect(node(el, "a").getAttribute("aria-expanded")).toBe("true");
  expect(node(el, "a").hasAttribute("data-selected")).toBe(true);
  expect(node(el, "d")).not.toBeNull();
  click(node(el, "y"));
  expect(node(el, "a").getAttribute("aria-expanded")).toBe("false");
  expect(node(el, "y").getAttribute("aria-expanded")).toBe("true");
  expect(node(el, "d")).toBeNull();
  expect(el.querySelector('[data-marker="y>z"]')?.textContent).toBe("+1");
  click(node(el, "x"));
  expect(node(el, "y").getAttribute("aria-expanded")).toBe("false");
  expect(node(el, "x").hasAttribute("data-selected")).toBe(true);
});

test("several lanes open with `multiple`", () => {
  const el = mount(<Demo multiple />);
  click(node(el, "a"));
  click(node(el, "y"));
  expect([node(el, "a").getAttribute("aria-expanded"), node(el, "y").getAttribute("aria-expanded")]).toEqual(["true", "true"]);
  expect(el.querySelectorAll("[data-band]")).toHaveLength(2);
});

test("a node below toggles its selection", () => {
  const el = mount(<Demo defaultOpen={["a"]} />);
  click(node(el, "b"));
  expect(node(el, "b").getAttribute("aria-pressed")).toBe("true");
  expect(node(el, "b").className).toBe("is-selected");
  click(node(el, "b"));
  expect(node(el, "b").getAttribute("aria-pressed")).toBe("false");
});

test("hovering traces a node's routes: on them highlighted, the rest dimmed", () => {
  const el = mount(<Demo defaultOpen={["a"]} />);
  fire(node(el, "b"), "mouseover");
  const on = (id: string) => node(el, id).hasAttribute("data-highlighted");
  const off = (id: string) => node(el, id).hasAttribute("data-dimmed");
  expect(["a", "b", "d"].map(on)).toEqual([true, true, true]);
  expect([off("c"), off("x"), off("y")]).toEqual([true, true, true]);
  const paths = [...el.querySelectorAll("path")].map((p) => p.getAttribute("class"));
  // a>b and b>d on the route; a>c and c>d not
  expect(paths).toEqual(["on", "off", "on", "off"]);
  fire(node(el, "b"), "mouseout");
  expect(node(el, "c").hasAttribute("data-dimmed")).toBe(false);
  // with nothing hovered, the selection traces
  click(node(el, "c"));
  fire(node(el, "c"), "mouseout");
  expect(node(el, "b").hasAttribute("data-dimmed")).toBe(true);
});

test("the same node lights up wherever it appears, as another lane's root too", () => {
  // b leads to y, which is also a lane of its own
  const shared: Lane<string>[] = [{ root: "a", edges: [["a", "b"], ["b", "y"], ["a", "c"]] }, { root: "y", edges: [] }, { root: "x", edges: [] }];
  const el = mount(
    <Graph.Root lanes={shared} rootSize={{ width: 1, height: 1 }} nodeSize={{ width: 1, height: 1 }} defaultOpen={["a"]}>
      <Graph.Canvas>
        <Graph.Nodes<string>>{(n) => <Graph.Node data-id={`${n.lane}/${n.id}`}>{n.id}</Graph.Node>}</Graph.Nodes>
      </Graph.Canvas>
    </Graph.Root>,
  );
  fire(node(el, "a/b"), "mouseover");
  expect(node(el, "y/y").hasAttribute("data-highlighted")).toBe(true);
  expect(node(el, "x/x").hasAttribute("data-dimmed")).toBe(true);
  expect(node(el, "a/c").hasAttribute("data-dimmed")).toBe(true);
});

test("arrow keys move between nodes, and the right arrow unfolds a folded root", () => {
  const el = mount(<Demo defaultOpen={["a"]} />);
  const key = (id: string, k: string) => fire(node(el, id), "keydown", { key: k });
  act(() => node(el, "b").focus());
  key("b", "ArrowDown");
  expect(document.activeElement).toBe(node(el, "c"));
  key("c", "ArrowRight");
  expect(document.activeElement).toBe(node(el, "d"));
  key("d", "ArrowLeft");
  expect(document.activeElement).toBe(node(el, "b"));
  key("b", "ArrowLeft");
  expect(document.activeElement).toBe(node(el, "a"));
  key("a", "ArrowDown");
  expect(document.activeElement).toBe(node(el, "x"));
  key("x", "ArrowDown");
  key("y", "ArrowRight");
  expect(node(el, "y").getAttribute("aria-expanded")).toBe("true");
});

test("keyboard navigation can be turned off", () => {
  const el = mount(<Demo defaultOpen={["a"]} keyboardNavigation={false} />);
  act(() => node(el, "b").focus());
  fire(node(el, "b"), "keydown", { key: "ArrowDown" });
  expect(document.activeElement).toBe(node(el, "b"));
});

test("controlled: open and selection follow the props, changes are reported", () => {
  const seen: { open: string[][]; selected: Selection<string>[] } = { open: [], selected: [] };
  function Controlled() {
    const [open, setOpen] = useState<string[]>(["a"]);
    return <Demo open={open} onOpenChange={(o) => { seen.open.push(o); setOpen(o); }} selected={null} onSelectedChange={(s) => seen.selected.push(s)} />;
  }
  const el = mount(<Controlled />);
  click(node(el, "y"));
  expect(seen.open).toEqual([["y"]]);
  expect(seen.selected).toEqual([{ lane: "y", id: "y" }]);
  expect(node(el, "y").getAttribute("aria-expanded")).toBe("true");
  // selection is controlled and stayed null
  expect(node(el, "y").hasAttribute("data-selected")).toBe(false);
});

test("your handler runs first, and preventDefault skips the graph's own", () => {
  const el = mount(
    <Graph.Root lanes={lanes} rootSize={{ width: 1, height: 1 }} nodeSize={{ width: 1, height: 1 }}>
      <Graph.Canvas>
        <Graph.Nodes>{(n) => <Graph.Node data-id={n.id} onClick={(e) => e.preventDefault()}>{n.id}</Graph.Node>}</Graph.Nodes>
      </Graph.Canvas>
    </Graph.Root>,
  );
  click(node(el, "a"));
  expect(node(el, "a").getAttribute("aria-expanded")).toBe("false");
});

test("another element than a button, and a panel of your own through useGraph", () => {
  function Panel() {
    const { selected } = useGraph<string>();
    return <p data-panel="">{selected ? `${selected.lane}/${selected.id}` : "none"}</p>;
  }
  const el = mount(
    <Graph.Root lanes={lanes} rootSize={{ width: 1, height: 1 }} nodeSize={{ width: 1, height: 1 }} defaultOpen={["a"]}>
      <Graph.Canvas>
        <Graph.Nodes>{(n) => <Graph.Node data-id={n.id} render={<div role="treeitem" tabIndex={0} aria-label={String(n.id)} />}>{n.id}</Graph.Node>}</Graph.Nodes>
      </Graph.Canvas>
      <Panel />
    </Graph.Root>,
  );
  expect(node(el, "b").tagName).toBe("DIV");
  expect(node(el, "b").getAttribute("role")).toBe("treeitem");
  click(node(el, "b"));
  expect(el.querySelector("[data-panel]")?.textContent).toBe("a/b");
});

test("measured sizes: hidden until every node is measured, then laid out from those sizes", () => {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  const size = (axis: "w" | "h") =>
    function (this: HTMLElement) {
      return Number(this.dataset[axis] ?? 0);
    };
  const saved = [Object.getOwnPropertyDescriptor(proto, "offsetWidth"), Object.getOwnPropertyDescriptor(proto, "offsetHeight")];
  Object.defineProperty(proto, "offsetWidth", { configurable: true, get: size("w") });
  Object.defineProperty(proto, "offsetHeight", { configurable: true, get: size("h") });
  try {
    const el = mount(
      <Graph.Root lanes={lanes} gap={{ column: 10, row: 5 }} defaultOpen={["a"]}>
        <Graph.Canvas data-testid="canvas">
          <Graph.Nodes>{(n) => <Graph.Node data-id={n.id} data-w={n.id === "a" ? "80" : "40"} data-h="10">{n.id}</Graph.Node>}</Graph.Nodes>
        </Graph.Canvas>
      </Graph.Root>,
    );
    const canvas = el.querySelector<HTMLElement>('[data-testid="canvas"]')!;
    expect(canvas.hasAttribute("data-measuring")).toBe(false);
    // b sits after the measured root (80) and the gap; no width or height is forced on a measured node
    expect(node(el, "b").style.left).toBe("90px");
    expect(node(el, "b").style.width).toBe("");
    expect(node(el, "c").style.top).toBe("15px");
  } finally {
    for (const [name, d] of [["offsetWidth", saved[0]], ["offsetHeight", saved[1]]] as const) if (d) Object.defineProperty(proto, name, d);
  }
});
