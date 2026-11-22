import { useState, type ReactNode } from "react";
import { DependencyDemo } from "./demos/DependencyDemo";
import { FileTreeDemo } from "./demos/FileTreeDemo";
import { OrgChartDemo } from "./demos/OrgChartDemo";

const REPO = "https://github.com/Agnes-HQ/treelines";
const base = import.meta.env.BASE_URL;

function Install() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="install"
      onClick={async () => {
        await navigator.clipboard.writeText("npm install treelines");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <code>npm install treelines</code>
      <span className="install-hint">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function Demo({ id, title, children, text, source }: { id: string; title: string; text: ReactNode; source: string; children: ReactNode }) {
  return (
    <section className="demo" aria-labelledby={`${id}-title`}>
      <div className="demo-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <p>{text}</p>
        <a href={`${REPO}/blob/main/site/src/demos/${source}`}>View the code</a>
      </div>
      <div className="demo-stage">{children}</div>
    </section>
  );
}

export function App() {
  return (
    <>
      <header className="top">
        <a href={base} className="brand" aria-label="treelines home">
          <picture>
            <source media="(prefers-color-scheme: dark)" srcSet={`${base}logo-dark.svg`} />
            <img src={`${base}logo-light.svg`} alt="treelines" width="170" height="48" />
          </picture>
        </a>
        <nav aria-label="Links">
          <a href={`${REPO}#readme`}>Docs</a>
          <a href={REPO}>GitHub</a>
          <a href="https://www.npmjs.com/package/treelines">npm</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <h1>
            Layout and connector lines for trees and graphs in React. <span className="accent">You render the nodes.</span>
          </h1>
          <p className="lead">
            Give treelines nested data, or nodes and edges. It places your elements in columns, draws the lines between them,
            and handles unfolding, selection, route tracing and the keyboard. No styles and no cards of its own: the state
            reaches your markup as data attributes.
          </p>
          <Install />
        </section>

        <Demo
          id="deps"
          title="Which dependency brings in what"
          source="DependencyDemo.tsx"
          text={
            <>
              One lane per direct dependency; open one and its routes unfold to the right. Packages that only pass a route on
              fold into "+N". Hover or focus a package to trace its routes, select it for details. Sample data.
            </>
          }
        >
          <DependencyDemo />
        </Demo>

        <Demo
          id="org"
          title="An org chart"
          source="OrgChartDemo.tsx"
          text={<>Nested data growing downwards, with right-angled connectors. Select a person to light up their reporting line.</>}
        >
          <OrgChartDemo />
        </Demo>

        <Demo
          id="files"
          title="Measured nodes"
          source="FileTreeDemo.tsx"
          text={<>No sizes given: every node is measured as rendered, so cards can be as wide as their content. Several folders can be open at once.</>}
        >
          <FileTreeDemo />
        </Demo>

        <section className="how" aria-labelledby="how-title">
          <h2 id="how-title">Style it with plain CSS</h2>
          <p>Every node and connector says what state it is in. Target the attributes in your own CSS, or pass className and style as functions of the state.</p>
          <pre>
            <code>{`[data-root]        /* a lane's root */
[data-expanded]    /* its lane is unfolded */
[data-selected]    /* the selected node */
[data-highlighted] /* on a route through the hovered node */
[data-dimmed]      /* routes are traced, this is not on one */`}</code>
          </pre>
          <p>
            The full API, the React-free core and accessibility notes are in the <a href={`${REPO}#readme`}>README</a>.
          </p>
        </section>
      </main>

      <footer className="foot">
        <p>
          MIT © <a href="https://agnes.dev">Agnes</a>. treelines draws the dependency graph in Agnes, which tracks the health of
          frontend repositories.
        </p>
      </footer>
    </>
  );
}
