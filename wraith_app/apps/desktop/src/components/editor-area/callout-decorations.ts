import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  type DecorationSet,
  WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

const CALLOUT_RE = /^(\s*>\s*\[!([A-Za-z][\w-]*)\]([+-])?)(?:\s+(.*))?$/;

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

function titleForType(type: string) {
  return type
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

class CalloutMarkerWidget extends WidgetType {
  constructor(
    readonly type: string,
    readonly hasTitle: boolean,
  ) {
    super();
  }

  eq(other: CalloutMarkerWidget) {
    return this.type === other.type && this.hasTitle === other.hasTitle;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-callout-title-prefix";
    span.textContent = this.hasTitle ? "" : titleForType(this.type);
    return span;
  }

  ignoreEvent() {
    return false;
  }
}

function buildDecorations(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const match = line.text.match(CALLOUT_RE);
      if (match && !isInCode(view, line.from)) {
        const type = match[2].toLowerCase();
        const title = match[4]?.trim() ?? "";
        const tone = TYPE_TO_TONE[type] ?? "generic";
        const markerEnd = match[1].length;
        const titleGap = title ? (line.text.slice(markerEnd).match(/^\s+/)?.[0].length ?? 0) : 0;
        const replaceTo = line.from + markerEnd + titleGap;
        builder.add(
          line.from,
          line.from,
          Decoration.line({
            class: `cm-callout-line cm-callout-start cm-callout-${tone}`,
            attributes: { "data-callout-type": type },
          }),
        );
        builder.add(
          line.from,
          replaceTo,
          Decoration.replace({
            widget: new CalloutMarkerWidget(type, Boolean(title)),
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
    "--pm-blockquote-vertical-line-background-color": "var(--callout-border-color)",
  },
  ".cm-callout-start": {
    fontWeight: "600",
  },
  ".cm-callout-title-prefix": {
    fontWeight: "600",
  },
  ".cm-callout-info": {
    "--callout-border-color": "color-mix(in srgb, var(--accent) 80%, white)",
  },
  ".cm-callout-success": {
    "--callout-border-color": "#4f9f68",
  },
  ".cm-callout-warning": {
    "--callout-border-color": "#b58a2a",
  },
  ".cm-callout-danger": {
    "--callout-border-color": "#b85c5c",
  },
  ".cm-callout-question": {
    "--callout-border-color": "#7d72c6",
  },
  ".cm-callout-example": {
    "--callout-border-color": "#8a72a8",
  },
  ".cm-callout-quote": {
    "--callout-border-color": "var(--text-muted)",
  },
  ".cm-callout-generic": {
    "--callout-border-color": "var(--accent)",
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
