import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import { convertFileSrc } from "@tauri-apps/api/core";
import * as editorApi from "@/hooks/editor-api";
import { getFileName, getParentDir } from "@/lib/paths";
import * as tauri from "@/lib/tauri";

const MARKDOWN_IMAGE_RE = /!\[([^\]\n]*)\]\(([^)\n]+)\)/g;

function isExternalImageSrc(src: string) {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("asset:") ||
    src.startsWith("data:") ||
    src.startsWith("blob:")
  );
}

function stripLinkSuffix(path: string) {
  const hashIndex = path.indexOf("#");
  const queryIndex = path.indexOf("?");
  const splitIndex =
    hashIndex === -1 ? queryIndex : queryIndex === -1 ? hashIndex : Math.min(hashIndex, queryIndex);
  return splitIndex === -1 ? path : path.slice(0, splitIndex);
}

function parseImageTarget(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<")) {
    const close = trimmed.indexOf(">");
    return close === -1 ? trimmed.slice(1).trim() : trimmed.slice(1, close).trim();
  }

  const titleMatch = trimmed.match(/^(\S+)\s+["'][^"']*["']$/);
  return titleMatch?.[1] ?? trimmed;
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

async function resolveMarkdownImage(
  target: string,
  currentFilePath: string,
  workspaceRoot: string | null,
) {
  if (isExternalImageSrc(target)) {
    return { src: target, localPath: null };
  }

  const cleanTarget = stripLinkSuffix(target);
  if (workspaceRoot) {
    const resolved = await tauri
      .resolveVaultAsset(workspaceRoot, currentFilePath, cleanTarget)
      .catch(() => null);
    if (resolved?.file_kind === "image") {
      return { src: convertFileSrc(resolved.path), localPath: resolved.path };
    }
  }

  const absolute = cleanTarget.startsWith("/")
    ? cleanTarget
    : `${getParentDir(currentFilePath)}/${cleanTarget}`;
  const exists = await tauri.fileExists(absolute).catch(() => false);
  if (exists) {
    return { src: convertFileSrc(absolute), localPath: absolute };
  }

  return null;
}

class MarkdownImageWidget extends WidgetType {
  constructor(
    readonly alt: string,
    readonly target: string,
    readonly currentFilePath: string,
    readonly workspaceRoot: string | null,
  ) {
    super();
  }

  eq(other: MarkdownImageWidget) {
    return (
      this.alt === other.alt &&
      this.target === other.target &&
      this.currentFilePath === other.currentFilePath &&
      this.workspaceRoot === other.workspaceRoot
    );
  }

  toDOM() {
    const wrapper = document.createElement("figure");
    wrapper.className = "cm-markdown-image-embed cm-obsidian-embed cm-obsidian-image-embed";
    wrapper.contentEditable = "false";

    const img = wrapper.appendChild(document.createElement("img"));
    img.alt = this.alt || getFileName(this.target);
    img.title = this.target;
    img.addEventListener("error", () => {
      wrapper.classList.add("cm-obsidian-embed-missing");
      wrapper.textContent = `Could not load image: ${this.target}`;
    });

    void resolveMarkdownImage(this.target, this.currentFilePath, this.workspaceRoot).then((resolved) => {
      if (!resolved) {
        wrapper.classList.add("cm-obsidian-embed-missing");
        wrapper.textContent = `Missing image: ${this.target}`;
        return;
      }

      img.src = resolved.src;
      wrapper.title = resolved.localPath ? "Open image" : "Open image URL";
      wrapper.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (resolved.localPath) {
          editorApi.openAsset(resolved.localPath, "image");
        } else {
          window.open(this.target, "_blank", "noopener,noreferrer");
        }
      });
    });

    return wrapper;
  }
}

function buildDecorations(view: EditorView, currentFilePath: string, workspaceRoot: string | null) {
  const builder = new RangeSetBuilder<Decoration>();

  for (const range of view.visibleRanges) {
    const text = view.state.doc.sliceString(range.from, range.to);
    MARKDOWN_IMAGE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MARKDOWN_IMAGE_RE.exec(text))) {
      const from = range.from + match.index;
      const to = from + match[0].length;
      if (isInCode(view, from)) continue;

      const target = parseImageTarget(match[2]);
      if (!target) continue;

      builder.add(
        to,
        to,
        Decoration.widget({
          widget: new MarkdownImageWidget(match[1], target, currentFilePath, workspaceRoot),
          block: true,
          side: 1,
        }),
      );
    }
  }

  return builder.finish();
}

export function markdownImageDecorations(
  getFilePath: () => string,
  getWorkspaceRoot: () => string | null,
) {
  return ViewPlugin.fromClass(
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
  );
}
