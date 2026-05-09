import { useMemo, useState, type ReactNode } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FileViewIcon,
  FolderOpenIcon,
  ImageActualSizeIcon,
  SquareArrowDiagonal01Icon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
} from "@hugeicons/core-free-icons";
import { useWorkspaceRoot } from "@/hooks/use-workspace";
import * as tauri from "@/lib/tauri";
import { getFileName, getRelativePath } from "@/lib/paths";
import { definePageKind } from "./types";

export type AssetFileKind = "image" | "pdf";
export type AssetLocation = { kind: "asset"; path: string; fileKind: AssetFileKind };

function isAssetFileKind(value: unknown): value is AssetFileKind {
  return value === "image" || value === "pdf";
}

function AssetIconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-icon-muted)] transition-colors enabled:hover:bg-[var(--surface-subtle)] enabled:hover:text-[var(--text-secondary)] disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function runAssetAction(action: () => Promise<void>) {
  void action().catch((error: unknown) => {
    window.alert(`Failed: ${error instanceof Error ? error.message : String(error)}`);
  });
}

function AssetViewer({ location }: { location: AssetLocation; isActive: boolean }) {
  const workspaceRoot = useWorkspaceRoot();
  const name = getFileName(location.path);
  const relativePath = workspaceRoot ? getRelativePath(location.path, workspaceRoot) : location.path;
  const src = useMemo(() => convertFileSrc(location.path), [location.path]);
  const [imageScale, setImageScale] = useState<number | "fit">("fit");
  const [imageFailed, setImageFailed] = useState(false);
  const imageScaleLabel = imageScale === "fit" ? "Fit" : `${Math.round(imageScale * 100)}%`;

  return (
    <div
      className="relative z-0 box-border flex h-full min-h-0 flex-col overflow-hidden text-[13px] text-[var(--text-secondary)]"
      style={{
        paddingTop: "calc(var(--chrome-control-height) + var(--chrome-control-padding) * 2)",
      }}
    >
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--line-subtle)] px-4">
        <HugeiconsIcon
          icon={location.fileKind === "pdf" ? FileViewIcon : ImageActualSizeIcon}
          size={17}
          color="currentColor"
          strokeWidth={2}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-[var(--text-secondary)]">{name}</div>
          <div className="truncate text-[12px] text-[var(--text-muted)]">{relativePath}</div>
        </div>
        {location.fileKind === "image" ? (
          <div className="flex shrink-0 items-center gap-1">
            <AssetIconButton
              label="Fit"
              onClick={() => {
                setImageScale("fit");
                setImageFailed(false);
              }}
            >
              <HugeiconsIcon icon={ImageActualSizeIcon} size={15} color="currentColor" strokeWidth={2} />
            </AssetIconButton>
            <AssetIconButton
              label="Zoom out"
              disabled={imageScale !== "fit" && imageScale <= 0.25}
              onClick={() =>
                setImageScale((scale) =>
                  scale === "fit" ? 0.75 : Math.max(0.25, Number((scale - 0.25).toFixed(2))),
                )
              }
            >
              <HugeiconsIcon icon={ZoomOutAreaIcon} size={15} color="currentColor" strokeWidth={2} />
            </AssetIconButton>
            <span className="w-10 text-center text-[12px] text-[var(--text-muted)]">
              {imageScaleLabel}
            </span>
            <AssetIconButton
              label="Zoom in"
              disabled={imageScale !== "fit" && imageScale >= 4}
              onClick={() =>
                setImageScale((scale) =>
                  scale === "fit" ? 1.25 : Math.min(4, Number((scale + 0.25).toFixed(2))),
                )
              }
            >
              <HugeiconsIcon icon={ZoomInAreaIcon} size={15} color="currentColor" strokeWidth={2} />
            </AssetIconButton>
          </div>
        ) : null}
        <AssetIconButton
          label="Reveal in Finder"
          onClick={() => runAssetAction(() => tauri.revealInFileManager(location.path))}
        >
          <HugeiconsIcon icon={FolderOpenIcon} size={15} color="currentColor" strokeWidth={2} />
        </AssetIconButton>
        <AssetIconButton label="Open externally" onClick={() => runAssetAction(() => tauri.openPath(location.path))}>
          <HugeiconsIcon
            icon={SquareArrowDiagonal01Icon}
            size={15}
            color="currentColor"
            strokeWidth={2}
          />
        </AssetIconButton>
      </div>

      {location.fileKind === "image" ? (
        <div className="min-h-0 flex-1 overflow-auto p-6">
          {imageFailed ? (
            <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-muted)]">
              Could not load preview.
            </div>
          ) : (
            <div className="flex min-h-full items-center justify-center">
              <img
                src={src}
                alt={name}
                draggable={false}
                onError={() => setImageFailed(true)}
                className={
                  imageScale === "fit"
                    ? "max-h-full max-w-full object-contain"
                    : "h-auto max-w-none rounded-sm"
                }
                style={imageScale === "fit" ? undefined : { width: `${imageScale * 100}%` }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--bg)]">
          <object
            title={name}
            data={src}
            type="application/pdf"
            className="block h-full min-h-[320px] w-full bg-[var(--bg)]"
          >
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 px-8 text-center">
              <HugeiconsIcon icon={FileViewIcon} size={34} color="currentColor" strokeWidth={1.8} />
              <div>
                <div className="text-[15px] font-semibold text-[var(--text-secondary)]">
                  PDF preview failed
                </div>
                <div className="mt-1 max-w-md text-[13px] leading-6 text-[var(--text-muted)]">
                  Wraith could not render this PDF in the preview.
                </div>
              </div>
              <button
                type="button"
                className="right-sidebar-button"
                onClick={() => runAssetAction(() => tauri.openPath(location.path))}
              >
                Open externally
              </button>
            </div>
          </object>
        </div>
      )}
    </div>
  );
}

export const assetKind = definePageKind<"asset", AssetLocation>({
  kind: "asset",
  title: (l) => getFileName(l.path),
  description: "Open asset",
  Component: AssetViewer,
  keepAlive: false,
  supportsFileContextMenu: true,
  fromPayload: (data) =>
    typeof data.path === "string" && isAssetFileKind(data.fileKind)
      ? { kind: "asset", path: data.path, fileKind: data.fileKind }
      : null,
  paths: (l) => [l.path],
  primaryPath: (l) => l.path,
  rewritePath: (l, from, to) => (l.path === from ? { ...l, path: to } : l),
  removePath: (l, path) => (l.path === path ? null : l),
  serialize: (l) => ({ path: l.path, fileKind: l.fileKind }),
});
