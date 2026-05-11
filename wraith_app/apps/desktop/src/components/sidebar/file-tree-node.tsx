import {
  memo,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  File02Icon,
  FileImageIcon,
  FileQuestionMarkIcon,
  Folder01Icon,
  Folder02Icon,
  Pdf01Icon,
} from "@hugeicons/core-free-icons";
import { useSetting } from "@/hooks/use-settings";
import { useIsActive, useResolvedDocumentTitle } from "@/hooks/use-tabs";
import {
  beginFileTreePointerDrag,
  cancelFileTreePointerDrag,
  endFileTreePointerDrag,
  moveFileTreePointerDrag,
  type WraithFileTreeDragPayload,
} from "@/lib/drag-types";
import { getFileStem } from "@/lib/paths";
import type { DirEntry } from "@/types/fs";

function FolderIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <HugeiconsIcon
      icon={isExpanded ? Folder02Icon : Folder01Icon}
      size={16}
      color="currentColor"
      strokeWidth={2}
    />
  );
}

function FileIcon({ kind }: { kind: DirEntry["file_kind"] }) {
  const icon =
    kind === "image"
      ? FileImageIcon
      : kind === "pdf"
        ? Pdf01Icon
        : kind === "markdown"
          ? File02Icon
          : FileQuestionMarkIcon;

  return <HugeiconsIcon icon={icon} size={16} color="currentColor" strokeWidth={2} />;
}

function iconToneClass(entry: DirEntry, tones: Record<string, unknown>) {
  const accent = "text-[var(--accent)] opacity-90";
  if (entry.is_dir) {
    return tones["sidebar.folder-color"] === "accent"
      ? accent
      : "text-[var(--fg-base)] opacity-[0.54]";
  }
  if (entry.file_kind === "markdown") {
    return tones["sidebar.markdown-color"] === "accent"
      ? accent
      : "text-[var(--fg-base)] opacity-[0.54]";
  }
  if (entry.file_kind === "image") {
    return tones["sidebar.image-color"] === "accent"
      ? accent
      : "text-[var(--accent)] opacity-[0.54]";
  }
  if (entry.file_kind === "pdf") {
    return tones["sidebar.pdf-color"] === "accent"
      ? accent
      : "text-[var(--text-secondary)] opacity-[0.54]";
  }
  return tones["sidebar.other-color"] === "accent"
    ? accent
    : "text-[var(--fg-base)] opacity-[0.54]";
}

interface FileTreeNodeProps {
  entry: DirEntry;
  depth: number;
  isExpanded: boolean;
  isRenaming: boolean;
  isSelected: boolean;
  onToggleDir: (path: string) => Promise<void>;
  onOpenFile: (path: string) => Promise<void>;
  onClick?: (event: MouseEvent<HTMLElement>, entry: DirEntry) => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>, entry: DirEntry) => void;
  onDropFiles?: (event: DragEvent<HTMLElement>, entry: DirEntry) => void;
  onRenameSubmit?: (entry: DirEntry, nextStem: string) => void;
  onRenameCancel?: () => void;
}

export const FileTreeNode = memo(function FileTreeNode({
  entry,
  depth,
  isExpanded,
  isRenaming,
  isSelected,
  onToggleDir,
  onOpenFile,
  onClick,
  onContextMenu,
  onDropFiles,
  onRenameSubmit,
  onRenameCancel,
}: FileTreeNodeProps) {
  const isActive = useIsActive(entry.path);
  const iconTones = {
    "sidebar.folder-color": useSetting("sidebar.folder-color"),
    "sidebar.markdown-color": useSetting("sidebar.markdown-color"),
    "sidebar.image-color": useSetting("sidebar.image-color"),
    "sidebar.pdf-color": useSetting("sidebar.pdf-color"),
    "sidebar.other-color": useSetting("sidebar.other-color"),
  };
  const editorTitle = useResolvedDocumentTitle(entry.is_dir ? null : entry.path);
  const displayName = entry.is_dir
    ? entry.name
    : entry.is_markdown
      ? editorTitle || entry.title || getFileStem(entry.name)
      : entry.name;
  const inputRef = useRef<HTMLInputElement>(null);
  const dropDepthRef = useRef(0);
  const pendingPointerDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    payload: WraithFileTreeDragPayload;
    wasDragging: boolean;
    previousCursor: string;
    previousUserSelect: string;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const canDragToSplit =
    !entry.is_dir && (entry.is_markdown || entry.file_kind === "image" || entry.file_kind === "pdf");

  // Auto-focus and select the stem when entering rename mode.
  useEffect(() => {
    if (!isRenaming) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [isRenaming]);

  const toneClassName = entry.is_dir
    ? "text-[var(--text-muted)]"
    : isActive
      ? "text-[var(--text-secondary)]"
      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]";

  function handleClick(event: MouseEvent<HTMLElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (isRenaming) return;
    // All clicks go through onClick so the parent can manage selection.
    // The parent decides whether to also open/toggle based on modifiers.
    if (onClick) {
      onClick(event, entry);
      return;
    }
    if (entry.is_dir) {
      void onToggleDir(entry.path);
    } else {
      void onOpenFile(entry.path);
    }
  }

  function handleContextMenu(event: MouseEvent<HTMLElement>) {
    if (!onContextMenu) return;
    event.preventDefault();
    event.stopPropagation();
    onContextMenu(event, entry);
  }

  function isExternalFileDrag(event: DragEvent<HTMLElement>) {
    return event.dataTransfer.types.includes("Files");
  }

  function fileTreeDragPayload(): WraithFileTreeDragPayload | null {
    if (!canDragToSplit) return null;
    return {
      path: entry.path,
      fileKind: entry.is_markdown ? "markdown" : entry.file_kind === "pdf" ? "pdf" : "image",
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || isRenaming) return;
    const payload = fileTreeDragPayload();
    if (!payload) return;

    pendingPointerDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      payload,
      wasDragging: false,
      previousCursor: "",
      previousUserSelect: "",
    };

    function cleanup(finish: "drop" | "cancel", clientX: number, clientY: number) {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);

      const current = pendingPointerDragRef.current;
      pendingPointerDragRef.current = null;
      if (!current?.wasDragging) return;

      document.documentElement.style.cursor = current.previousCursor;
      document.body.style.userSelect = current.previousUserSelect;

      if (finish === "drop") {
        endFileTreePointerDrag(clientX, clientY);
      } else {
        cancelFileTreePointerDrag();
      }

      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 200);
    }

    function handlePointerMove(moveEvent: PointerEvent) {
      const current = pendingPointerDragRef.current;
      if (!current || moveEvent.pointerId !== current.pointerId) return;

      if (!current.wasDragging) {
        const distance = Math.hypot(moveEvent.clientX - current.startX, moveEvent.clientY - current.startY);
        if (distance < 6) return;

        current.wasDragging = true;
        current.previousCursor = document.documentElement.style.cursor;
        current.previousUserSelect = document.body.style.userSelect;
        suppressClickRef.current = true;
        document.documentElement.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        beginFileTreePointerDrag(current.payload, moveEvent.clientX, moveEvent.clientY);
        moveEvent.preventDefault();
        return;
      }

      moveFileTreePointerDrag(moveEvent.clientX, moveEvent.clientY);
      moveEvent.preventDefault();
    }

    function handlePointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pendingPointerDragRef.current?.pointerId) return;
      cleanup("drop", upEvent.clientX, upEvent.clientY);
    }

    function handlePointerCancel(cancelEvent: PointerEvent) {
      if (cancelEvent.pointerId !== pendingPointerDragRef.current?.pointerId) return;
      cleanup("cancel", cancelEvent.clientX, cancelEvent.clientY);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
  }

  function clearDropTarget() {
    dropDepthRef.current = 0;
    setIsDropTarget(false);
  }

  if (isRenaming) {
    // Directories show the full name; files show only the stem (extension is appended on submit).
    const initialValue = entry.is_dir ? entry.name : getFileStem(entry.name);
    return (
      <div
        className={`flex h-[32px] w-full items-center gap-1.5 overflow-hidden rounded-lg pr-2 text-[13px] leading-[1.15] ${
          isActive ? "bg-[var(--surface-subtle)]" : ""
        }`}
        style={{ paddingLeft: depth === 0 ? 10 : depth * 12 + 6 }}
      >
        <span
          className={`flex w-5 shrink-0 items-center justify-center ${iconToneClass(entry, iconTones)}`}
          aria-hidden="true"
        >
          {entry.is_dir ? <FolderIcon isExpanded={isExpanded} /> : <FileIcon kind={entry.file_kind} />}
        </span>
        <input
          ref={inputRef}
          type="text"
          defaultValue={initialValue}
          aria-label={`Rename ${entry.name}`}
          className="min-w-0 flex-1 rounded border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-1 py-px text-[13px] leading-[1.15] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onRenameSubmit?.(entry, event.currentTarget.value);
            } else if (event.key === "Escape") {
              event.preventDefault();
              onRenameCancel?.();
            }
          }}
          onBlur={(event) => onRenameSubmit?.(entry, event.currentTarget.value)}
        />
      </div>
    );
  }

  const bgClassName = isSelected
    ? "bg-[var(--surface-selected)]"
    : isActive
      ? "bg-[var(--surface-subtle)]"
      : "hover:bg-[var(--surface-subtle)]";

  return (
    <button
      type="button"
      role="treeitem"
      data-file-tree-path={entry.path}
      data-file-tree-is-dir={entry.is_dir ? "true" : "false"}
      aria-selected={isActive}
      aria-expanded={entry.is_dir ? isExpanded : undefined}
      aria-label={entry.is_dir ? `${entry.name} folder` : displayName}
      onMouseDown={(event) => {
        if (!canDragToSplit) event.preventDefault();
      }}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      draggable={false}
      onDragEnter={(event) => {
        if (!onDropFiles || !isExternalFileDrag(event)) return;
        dropDepthRef.current += 1;
        setIsDropTarget(true);
      }}
      onDragOver={(event) => {
        if (!onDropFiles) return;
        if (!isExternalFileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!isExternalFileDrag(event)) return;
        dropDepthRef.current = Math.max(0, dropDepthRef.current - 1);
        if (dropDepthRef.current === 0) setIsDropTarget(false);
      }}
      onDrop={(event) => {
        clearDropTarget();
        onDropFiles?.(event, entry);
      }}
      className={`flex h-[32px] w-full items-center gap-1.5 overflow-hidden rounded-lg pr-2 text-left text-[13px] leading-[1.15] transition-[background-color,color,box-shadow,transform] duration-[var(--motion-quick-duration)] ease-[var(--motion-soft-ease)] ${
        isDropTarget
          ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--text-secondary)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
          : `${toneClassName} ${bgClassName}`
      } ${canDragToSplit ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ paddingLeft: depth === 0 ? 10 : depth * 12 + 6 }}
    >
      <span className={`flex w-5 shrink-0 items-center justify-center ${iconToneClass(entry, iconTones)}`}>
        {entry.is_dir ? <FolderIcon isExpanded={isExpanded} /> : <FileIcon kind={entry.file_kind} />}
      </span>
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{displayName}</span>
    </button>
  );
});
