import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import katex from "katex";
import "katex/dist/katex.min.css";

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

class MathWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly displayMode: boolean,
  ) {
    super();
  }

  eq(other: MathWidget) {
    return this.source === other.source && this.displayMode === other.displayMode;
  }

  toDOM() {
    const wrapper = document.createElement(this.displayMode ? "div" : "span");
    wrapper.className = this.displayMode ? "cm-math-widget cm-math-block" : "cm-math-widget";
    wrapper.contentEditable = "false";
    try {
      katex.render(this.source, wrapper, {
        displayMode: this.displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      wrapper.textContent = this.source;
    }
    return wrapper;
  }
}

function buildDecorations(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc.toString();
  const { from: selectionFrom, to: selectionTo } = view.state.selection.main;
  const blockRanges: Array<{ from: number; to: number }> = [];

  const blockRe = /\$\$([\s\S]+?)\$\$/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(doc))) {
    const from = block.index;
    const to = from + block[0].length;
    if (selectionFrom <= to && selectionTo >= from) continue;
    if (isInCode(view, from)) continue;
    blockRanges.push({ from, to });
    builder.add(
      from,
      to,
      Decoration.replace({
        widget: new MathWidget(block[1].trim(), true),
        block: true,
      }),
    );
  }

  const inlineRe = /(^|[^\\$])\$([^$\n]+?)\$/g;
  let inline: RegExpExecArray | null;
  while ((inline = inlineRe.exec(doc))) {
    const from = inline.index + inline[1].length;
    const to = from + inline[0].length - inline[1].length;
    if (blockRanges.some((range) => from >= range.from && to <= range.to)) continue;
    if (selectionFrom <= to && selectionTo >= from) continue;
    if (isInCode(view, from)) continue;
    builder.add(
      from,
      to,
      Decoration.replace({
        widget: new MathWidget(inline[2].trim(), false),
      }),
    );
  }

  return builder.finish();
}

const mathTheme = EditorView.baseTheme({
  ".cm-math-widget": {
    color: "var(--text-secondary)",
  },
  ".cm-math-block": {
    padding: "0.75em 0",
    overflowX: "auto",
  },
});

export function mathDecorations() {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildDecorations(view);
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = buildDecorations(update.view);
          }
        }
      },
      {
        decorations: (v) => v.decorations,
      },
    ),
    mathTheme,
  ];
}
