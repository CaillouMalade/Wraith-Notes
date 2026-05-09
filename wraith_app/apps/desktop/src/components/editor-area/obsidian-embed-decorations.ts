import { RangeSetBuilder } from "@codemirror/state";
import {
  EditorView,
  Decoration,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getFileName } from "@/lib/paths";
import * as editorApi from "@/hooks/editor-api";
import * as tauri from "@/lib/tauri";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tiff"]);
const EMBED_RE = /!\[\[([^\]]+)\]\]/g;
type EmbedAssetKind = "image" | "pdf";

function splitModifier(raw: string) {
  const index = raw.indexOf("|");
  return index === -1
    ? { target: raw.trim(), modifier: null }
    : { target: raw.slice(0, index).trim(), modifier: raw.slice(index + 1).trim() || null };
}

function stripLinkSuffix(path: string) {
  const hashIndex = path.indexOf("#");
  const queryIndex = path.indexOf("?");
  const splitIndex =
    hashIndex === -1 ? queryIndex : queryIndex === -1 ? hashIndex : Math.min(hashIndex, queryIndex);
  return splitIndex === -1 ? path : path.slice(0, splitIndex);
}

function extension(path: string) {
  const name = getFileName(stripLinkSuffix(path));
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function embedAssetKind(path: string): EmbedAssetKind | null {
  const ext = extension(path);
  if (ext === "pdf") return "pdf";
  return IMAGE_EXTENSIONS.has(ext) ? "image" : null;
}

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

async function resolveEmbedAsset(
  target: string,
  expectedKind: EmbedAssetKind,
  currentFilePath: string,
  workspaceRoot: string | null,
) {
  if (!workspaceRoot) return null;
  const result = await tauri.resolveVaultAsset(workspaceRoot, currentFilePath, stripLinkSuffix(target));
  return result?.file_kind === expectedKind ? result.path : null;
}

class ObsidianImageWidget extends WidgetType {
  constructor(
    readonly target: string,
    readonly modifier: string | null,
    readonly currentFilePath: string,
    readonly workspaceRoot: string | null,
  ) {
    super();
  }

  eq(other: ObsidianImageWidget) {
    return (
      this.target === other.target &&
      this.modifier === other.modifier &&
      this.currentFilePath === other.currentFilePath &&
      this.workspaceRoot === other.workspaceRoot
    );
  }

  toDOM() {
    const wrapper = document.createElement("figure");
    wrapper.className = "cm-obsidian-embed cm-obsidian-image-embed";
    wrapper.contentEditable = "false";

    const img = wrapper.appendChild(document.createElement("img"));
    img.alt = this.modifier && Number.isNaN(Number(this.modifier)) ? this.modifier : getFileName(this.target);
    img.title = this.target;
    img.addEventListener("error", () => {
      wrapper.classList.add("cm-obsidian-embed-missing");
      wrapper.textContent = `Could not load image: ${this.target}`;
    });

    void resolveEmbedAsset(this.target, "image", this.currentFilePath, this.workspaceRoot).then((path) => {
      if (!path) {
        wrapper.classList.add("cm-obsidian-embed-missing");
        wrapper.textContent = `Missing image: ${this.target}`;
        return;
      }
      img.src = convertFileSrc(path);
      wrapper.title = "Open image";
      wrapper.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        editorApi.openAsset(path, "image");
      });
    });

    return wrapper;
  }
}

class ObsidianPdfWidget extends WidgetType {
  constructor(
    readonly target: string,
    readonly modifier: string | null,
    readonly currentFilePath: string,
    readonly workspaceRoot: string | null,
  ) {
    super();
  }

  eq(other: ObsidianPdfWidget) {
    return (
      this.target === other.target &&
      this.modifier === other.modifier &&
      this.currentFilePath === other.currentFilePath &&
      this.workspaceRoot === other.workspaceRoot
    );
  }

  toDOM() {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-obsidian-embed cm-obsidian-file-embed cm-obsidian-pdf-embed";
    wrapper.contentEditable = "false";

    const badge = wrapper.appendChild(document.createElement("span"));
    badge.className = "cm-obsidian-file-embed-badge";
    badge.textContent = "PDF";

    const text = wrapper.appendChild(document.createElement("span"));
    text.className = "cm-obsidian-file-embed-text";
    text.textContent = this.modifier && Number.isNaN(Number(this.modifier)) ? this.modifier : getFileName(this.target);

    const detail = wrapper.appendChild(document.createElement("span"));
    detail.className = "cm-obsidian-file-embed-detail";
    detail.textContent = stripLinkSuffix(this.target);

    void resolveEmbedAsset(this.target, "pdf", this.currentFilePath, this.workspaceRoot).then((path) => {
      if (!path) {
        wrapper.classList.add("cm-obsidian-embed-missing");
        wrapper.textContent = `Missing PDF: ${this.target}`;
        return;
      }
      wrapper.title = "Open PDF";
      wrapper.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        editorApi.openAsset(path, "pdf");
      });
    });

    return wrapper;
  }
}

function buildDecorations(view: EditorView, currentFilePath: string, workspaceRoot: string | null) {
  const builder = new RangeSetBuilder<Decoration>();

  for (const range of view.visibleRanges) {
    const text = view.state.doc.sliceString(range.from, range.to);
    EMBED_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = EMBED_RE.exec(text))) {
      const from = range.from + match.index;
      const to = from + match[0].length;
      if (isInCode(view, from)) continue;

      const { target, modifier } = splitModifier(match[1]);
      const assetKind = embedAssetKind(target);
      if (!assetKind) {
        builder.add(
          from,
          to,
          Decoration.mark({ class: "cm-obsidian-unsupported-embed" }),
        );
        continue;
      }

      builder.add(
        to,
        to,
        Decoration.widget({
          widget:
            assetKind === "image"
              ? new ObsidianImageWidget(target, modifier, currentFilePath, workspaceRoot)
              : new ObsidianPdfWidget(target, modifier, currentFilePath, workspaceRoot),
          block: true,
          side: 1,
        }),
      );
    }
  }

  return builder.finish();
}

const obsidianEmbedTheme = EditorView.baseTheme({
  ".cm-obsidian-image-embed": {
    margin: "0.7em 0",
  },
  ".cm-obsidian-image-embed img": {
    display: "block",
    maxWidth: "100%",
    maxHeight: "70vh",
    borderRadius: "8px",
    cursor: "zoom-in",
  },
  ".cm-obsidian-file-embed": {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: "0.15em 0.7em",
    alignItems: "center",
    margin: "0.7em 0",
    padding: "0.75em 0.85em",
    border: "1px solid var(--line-subtle)",
    borderRadius: "8px",
    color: "var(--text-secondary)",
    backgroundColor: "var(--surface-subtle)",
    cursor: "pointer",
  },
  ".cm-obsidian-file-embed:hover": {
    borderColor: "var(--line)",
    backgroundColor: "var(--surface-selected)",
  },
  ".cm-obsidian-file-embed-badge": {
    gridRow: "1 / span 2",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "2.55em",
    height: "2em",
    border: "1px solid var(--line-subtle)",
    borderRadius: "6px",
    color: "var(--text-muted)",
    backgroundColor: "var(--surface-primary)",
    fontSize: "0.74em",
    fontWeight: "600",
  },
  ".cm-obsidian-file-embed-text": {
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "0.93em",
    fontWeight: "500",
  },
  ".cm-obsidian-file-embed-detail": {
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "var(--text-muted)",
    fontSize: "0.82em",
  },
  ".cm-obsidian-embed-missing": {
    padding: "0.7em 0.9em",
    border: "1px solid var(--line-subtle)",
    borderRadius: "8px",
    color: "var(--text-muted)",
    backgroundColor: "var(--surface-subtle)",
    fontSize: "0.9em",
  },
  ".cm-obsidian-unsupported-embed": {
    color: "var(--text-muted)",
    textDecoration: "underline wavy var(--line-subtle)",
  },
});

export function obsidianEmbedDecorations(
  getFilePath: () => string,
  getWorkspaceRoot: () => string | null,
) {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildDecorations(view, getFilePath(), getWorkspaceRoot());
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = buildDecorations(update.view, getFilePath(), getWorkspaceRoot());
          }
        }
      },
      {
        decorations: (v) => v.decorations,
      },
    ),
    obsidianEmbedTheme,
  ];
}
