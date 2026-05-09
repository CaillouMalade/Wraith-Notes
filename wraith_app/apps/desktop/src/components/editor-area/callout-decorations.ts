import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  type DecorationSet,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

const CALLOUT_RE = /^\s*>\s*\[!([A-Za-z][\w-]*)\]([+-])?(?:\s+(.*))?$/;

const TYPE_TO_TONE: Record<string, string> = {
  note: "info",
  abstract: "info",
  summary: "info",
  tldr: "info",
  info: "info",
  todo: "info",
  tip: "success",
  hint: "success",
  important: "warning",
  success: "success",
  check: "success",
  done: "success",
  question: "question",
  help: "question",
  faq: "question",
  warning: "warning",
  caution: "warning",
  attention: "warning",
  failure: "danger",
  fail: "danger",
  missing: "danger",
  danger: "danger",
  error: "danger",
  bug: "danger",
  example: "example",
  quote: "quote",
  cite: "quote",
};

function isInCode(view: EditorView, pos: number) {
  const cursor = syntaxTree(view.state).resolveInner(pos, -1).cursor();
  do {
    if (
      cursor.name === "FencedCode" ||
      cursor.name === "CodeBlock" ||
      cursor.name === "InlineCode" ||
      cursor.name === "CodeText"
    ) {
      return true;
    }
  } while (cursor.parent());
  return false;
}

function buildDecorations(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const match = line.text.match(CALLOUT_RE);
      if (match && !isInCode(view, line.from)) {
        const type = match[1].toLowerCase();
        const tone = TYPE_TO_TONE[type] ?? "generic";
        builder.add(
          line.from,
          line.from,
          Decoration.line({
            class: `cm-callout-line cm-callout-start cm-callout-${tone}`,
            attributes: { "data-callout-type": type },
          }),
        );

        let nextNumber = line.number + 1;
        while (nextNumber <= view.state.doc.lines) {
          const next = view.state.doc.line(nextNumber);
          if (!/^\s*>/.test(next.text)) break;
          builder.add(
            next.from,
            next.from,
            Decoration.line({ class: `cm-callout-line cm-callout-${tone}` }),
          );
          nextNumber += 1;
        }
      }
      if (line.to + 1 > to) break;
      pos = line.to + 1;
    }
  }

  return builder.finish();
}

const calloutTheme = EditorView.baseTheme({
  ".cm-callout-line": {
    backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)",
    borderLeft: "3px solid var(--accent)",
    paddingLeft: "12px",
  },
  ".cm-callout-start": {
    borderTopLeftRadius: "8px",
    borderTopRightRadius: "8px",
    fontWeight: "600",
  },
  ".cm-callout-info": {
    borderLeftColor: "color-mix(in srgb, var(--accent) 80%, white)",
  },
  ".cm-callout-success": {
    borderLeftColor: "#4f9f68",
  },
  ".cm-callout-warning": {
    borderLeftColor: "#b58a2a",
  },
  ".cm-callout-danger": {
    borderLeftColor: "#b85c5c",
  },
  ".cm-callout-question": {
    borderLeftColor: "#7d72c6",
  },
  ".cm-callout-example": {
    borderLeftColor: "#8a72a8",
  },
  ".cm-callout-quote": {
    borderLeftColor: "var(--text-muted)",
  },
});

export function calloutDecorations() {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildDecorations(view);
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = buildDecorations(update.view);
          }
        }
      },
      {
        decorations: (v) => v.decorations,
      },
    ),
    calloutTheme,
  ];
}
