import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { DependencyGraph } from "../examples/dependency-graph";
import { FileTree } from "../examples/file-tree";
import { OrgChart } from "../examples/org-chart";
import { Team } from "../examples/quick-start";

/** The README's examples, rendered: they must keep working as the package changes. */

test("org chart: grows downwards from the CEO, every report placed", () => {
  const html = renderToStaticMarkup(
    <OrgChart
      ceo={{ id: "ada", name: "Ada", role: "CEO", reports: [{ id: "bo", name: "Bo", role: "CTO", reports: [{ id: "cy", name: "Cy", role: "Engineer" }] }, { id: "di", name: "Di", role: "CFO" }] }}
    />,
  );
  for (const name of ["Ada", "Bo", "Cy", "Di"]) expect(html).toContain(`>${name}<`);
  // down: Bo is below Ada, beside Di
  expect(html).toMatch(/top:104px[^"]*"[^>]*>.*Bo/);
  expect(html.match(/<path /g)).toHaveLength(3);
});

test("file tree: measured, so hidden until the browser has measured it", () => {
  const html = renderToStaticMarkup(
    <FileTree folders={[{ path: "src", name: "src", children: [{ path: "src/index.ts", name: "index.ts" }] }, { path: "test", name: "test", children: [] }]} />,
  );
  expect(html).toContain("data-measuring");
  expect(html).toContain("visibility:hidden");
  expect(html).toContain(">src/<");
});

test("dependency graph: a lane per direct dependency, pass-through packages folded", () => {
  const html = renderToStaticMarkup(
    <DependencyGraph
      direct={["app-kit", "lint"]}
      edges={[["app-kit", "core"], ["core", "util"], ["util", "left-pad"], ["lint", "util"]]}
      packages={{ "left-pad": { name: "left-pad", problem: "deprecated" } }}
    />,
  );
  expect(html).toContain(">app-kit<");
  expect(html).toContain(">lint<");
  expect(html).toContain("Select a package.");
  // folded lanes show only their roots until one is opened
  expect(html).not.toContain(">left-pad<");
});

test("quick start: the README's code, word for word", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const file = readFileSync(new URL("../examples/quick-start.tsx", import.meta.url), "utf8");
  expect(readme).toContain(file.slice(file.indexOf("\n") + 1).trimEnd());
  const html = renderToStaticMarkup(<Team />);
  for (const name of ["Ada", "Bo", "Cy"]) expect(html).toContain(`>${name}<`);
});
