import { EditorView, ViewPlugin } from "@codemirror/view";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getParentDir } from "@/lib/paths";
import * as tauri from "@/lib/tauri";

function isExternalImageSrc(src: string) {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("asset:") ||
    src.startsWith("data:") ||
    src.startsWith("blob:")
  );
}

async function resolveImgSrc(
  img: HTMLImageElement,
  currentFilePath: string,
  workspaceRoot: string | null,
) {
  const src = img.getAttribute("src");
  if (!src) return;
  if (isExternalImageSrc(src)) return;

  const markdownDir = getParentDir(currentFilePath);
  let absolute = src.startsWith("/") ? src : `${markdownDir}/${src}`;
  if (workspaceRoot) {
    const resolved = await tauri.resolveVaultAsset(workspaceRoot, currentFilePath, src).catch(() => null);
    if (resolved?.file_kind === "image") absolute = resolved.path;
  }

  if (img.getAttribute("src") === src) {
    img.src = convertFileSrc(absolute);
  }
}

export function imageSrcResolver(
  getActivePath: () => string | null,
  getWorkspaceRoot: () => string | null,
) {
  return ViewPlugin.fromClass(
    class {
      observer: MutationObserver;

      constructor(view: EditorView) {
        const path = getActivePath();
        if (path) this.fixAll(view.dom, path, getWorkspaceRoot());

        this.observer = new MutationObserver((mutations) => {
          const path = getActivePath();
          if (!path) return;
          const workspaceRoot = getWorkspaceRoot();
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (node instanceof HTMLImageElement) void resolveImgSrc(node, path, workspaceRoot);
              else if (node instanceof HTMLElement) {
                for (const img of node.querySelectorAll("img"))
                  void resolveImgSrc(img as HTMLImageElement, path, workspaceRoot);
              }
            }
          }
        });
        this.observer.observe(view.dom, { childList: true, subtree: true });
      }

      fixAll(root: HTMLElement, path: string, workspaceRoot: string | null) {
        for (const img of root.querySelectorAll("img")) {
          void resolveImgSrc(img as HTMLImageElement, path, workspaceRoot);
        }
      }

      destroy() {
        this.observer.disconnect();
      }
    },
  );
}
