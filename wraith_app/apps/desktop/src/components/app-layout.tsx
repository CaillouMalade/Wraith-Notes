import { useCallback, useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SidebarRightIcon } from "@hugeicons/core-free-icons";
import { Sidebar } from "./sidebar";
import { EditorArea } from "./editor-area";
import { EditorTabs } from "./editor-area/editor-tabs";
import { RightSidebar } from "./right-sidebar";
import { SidebarToggleButton } from "./sidebar/sidebar-toggle-button";
import { useSidebar } from "@/hooks/use-sidebar";
import { useUIStore } from "@/stores/ui-store";

function clampSidebarWidth(width: number, maxSidebarWidth: number) {
  return Math.max(220, Math.min(maxSidebarWidth, Math.round(width)));
}

export function AppLayout() {
  const { isSidebarCollapsed, sidebarWidth, setSidebarWidth } = useSidebar();
  const isRightSidebarOpen = useUIStore((state) => state.isRightSidebarOpen);
  const setRightSidebarOpen = useUIStore((state) => state.setRightSidebarOpen);
  const rightSidebarWidth = useUIStore((state) => state.rightSidebarWidth);
  const setRightSidebarWidth = useUIStore((state) => state.setRightSidebarWidth);
  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const maxSidebarWidth = Math.max(280, Math.min(420, Math.floor(viewportWidth * 0.35)));
  const maxRightSidebarWidth = Math.max(320, Math.min(560, Math.floor(viewportWidth * 0.45)));
  const draggingRef = useRef(false);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const [draftSidebarWidth, setDraftSidebarWidth] = useState(() =>
    clampSidebarWidth(sidebarWidth, maxSidebarWidth),
  );
  const [draftRightSidebarWidth, setDraftRightSidebarWidth] = useState(() =>
    clampSidebarWidth(rightSidebarWidth, maxRightSidebarWidth),
  );
  const draftSidebarWidthRef = useRef(draftSidebarWidth);
  const draftRightSidebarWidthRef = useRef(draftRightSidebarWidth);
  const tabChromeLeft = isSidebarCollapsed ? 132 : draftSidebarWidth + 12;
  const tabChromeRight = isRightSidebarOpen ? draftRightSidebarWidth + 12 : 52;

  const setClampedSidebarWidth = useCallback(
    (nextWidth: number) => {
      const next = clampSidebarWidth(nextWidth, maxSidebarWidth);
      draftSidebarWidthRef.current = next;
      setDraftSidebarWidth(next);
      return next;
    },
    [maxSidebarWidth],
  );

  const setClampedRightSidebarWidth = useCallback(
    (nextWidth: number) => {
      const next = clampSidebarWidth(nextWidth, maxRightSidebarWidth);
      draftRightSidebarWidthRef.current = next;
      setDraftRightSidebarWidth(next);
      return next;
    },
    [maxRightSidebarWidth],
  );

  useEffect(() => {
    if (draggingRef.current) return;
    const nextWidth = clampSidebarWidth(sidebarWidth, maxSidebarWidth);
    draftSidebarWidthRef.current = nextWidth;
    setDraftSidebarWidth(nextWidth);
  }, [maxSidebarWidth, sidebarWidth]);

  useEffect(() => {
    if (draggingRef.current) return;
    const nextWidth = clampSidebarWidth(rightSidebarWidth, maxRightSidebarWidth);
    draftRightSidebarWidthRef.current = nextWidth;
    setDraftRightSidebarWidth(nextWidth);
  }, [maxRightSidebarWidth, rightSidebarWidth]);

  const handleSidebarResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;

      event.preventDefault();
      draggingRef.current = true;
      setIsSidebarDragging(true);

      const startX = event.clientX;
      const startWidth = draftSidebarWidthRef.current;
      const previousCursor = document.documentElement.style.cursor;
      const previousUserSelect = document.body.style.userSelect;

      document.documentElement.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
        document.documentElement.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setIsSidebarDragging(false);
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setClampedSidebarWidth(startWidth + moveEvent.clientX - startX);
      };

      const finishDrag = (shouldPersist: boolean) => {
        cleanup();
        draggingRef.current = false;

        const nextWidth = draftSidebarWidthRef.current;
        if (shouldPersist && nextWidth !== sidebarWidth) {
          void setSidebarWidth(nextWidth);
          return;
        }

        const syncedWidth = clampSidebarWidth(sidebarWidth, maxSidebarWidth);
        draftSidebarWidthRef.current = syncedWidth;
        setDraftSidebarWidth(syncedWidth);
      };

      const handlePointerUp = () => {
        finishDrag(true);
      };

      const handlePointerCancel = () => {
        finishDrag(false);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
    },
    [maxSidebarWidth, setClampedSidebarWidth, setSidebarWidth, sidebarWidth],
  );

  const handleRightSidebarResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;

      event.preventDefault();
      draggingRef.current = true;
      setIsSidebarDragging(true);

      const startX = event.clientX;
      const startWidth = draftRightSidebarWidthRef.current;
      const previousCursor = document.documentElement.style.cursor;
      const previousUserSelect = document.body.style.userSelect;

      document.documentElement.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
        document.documentElement.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setIsSidebarDragging(false);
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setClampedRightSidebarWidth(startWidth - (moveEvent.clientX - startX));
      };

      const finishDrag = (shouldPersist: boolean) => {
        cleanup();
        draggingRef.current = false;

        const nextWidth = draftRightSidebarWidthRef.current;
        if (shouldPersist && nextWidth !== rightSidebarWidth) {
          setRightSidebarWidth(nextWidth);
          return;
        }

        const syncedWidth = clampSidebarWidth(rightSidebarWidth, maxRightSidebarWidth);
        draftRightSidebarWidthRef.current = syncedWidth;
        setDraftRightSidebarWidth(syncedWidth);
      };

      const handlePointerUp = () => finishDrag(true);
      const handlePointerCancel = () => finishDrag(false);

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
    },
    [
      maxRightSidebarWidth,
      rightSidebarWidth,
      setClampedRightSidebarWidth,
      setRightSidebarWidth,
    ],
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent text-text-primary">
      <div
        data-tauri-drag-region
        className="absolute inset-x-0 top-0"
        style={{ height: "var(--chrome-drag-height)" }}
      />
      <div
        className="pointer-events-auto absolute left-0 top-0 z-50 flex items-center"
        style={{
          height: "calc(var(--chrome-control-height) + var(--chrome-control-padding) * 2)",
          padding: "var(--chrome-control-padding) 12px var(--chrome-control-padding) 92px",
        }}
      >
        <SidebarToggleButton />
      </div>
      <div
        className="pointer-events-none absolute top-0 z-40"
        style={{
          left: tabChromeLeft,
          right: tabChromeRight,
          transition: isSidebarDragging ? "none" : "left 140ms ease-out",
        }}
      >
        <div className="pointer-events-auto">
          <EditorTabs />
        </div>
      </div>
      {!isRightSidebarOpen && (
        <div
          className="pointer-events-auto absolute right-0 top-0 z-50 flex items-center"
          style={{
            height: "calc(var(--chrome-control-height) + var(--chrome-control-padding) * 2)",
            padding: "var(--chrome-control-padding) 12px var(--chrome-control-padding) 12px",
          }}
        >
          <button
            type="button"
            aria-label="Open right sidebar"
            title="Open right sidebar"
            onClick={() => setRightSidebarOpen(true)}
            className="flex h-[var(--chrome-control-height)] w-[var(--chrome-control-height)] items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
          >
            <HugeiconsIcon icon={SidebarRightIcon} size={18} color="currentColor" strokeWidth={2} />
          </button>
        </div>
      )}
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex min-h-0 flex-1">
          <div
            className="shrink-0 overflow-hidden"
            style={{
              width: isSidebarCollapsed ? 0 : draftSidebarWidth,
              transition: isSidebarDragging ? "none" : "width 140ms ease-out",
            }}
          >
            <div style={{ width: draftSidebarWidth }} className="h-full">
              <Sidebar />
            </div>
          </div>
          {!isSidebarCollapsed && (
            <div
              role="presentation"
              aria-hidden="true"
              data-dragging={isSidebarDragging || undefined}
              onPointerDown={handleSidebarResizeStart}
              className="relative w-0 shrink-0 cursor-col-resize before:absolute before:inset-y-0 before:-left-1 before:w-2 before:content-[''] after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-transparent after:transition-colors after:content-[''] hover:after:bg-[var(--line-subtle)] data-[dragging]:after:bg-[var(--border-color)]"
            />
          )}

          <div className="relative min-w-0 flex-1 bg-bg">
            <EditorArea />
          </div>
          {isRightSidebarOpen && (
            <div
              role="presentation"
              aria-hidden="true"
              data-dragging={isSidebarDragging || undefined}
              onPointerDown={handleRightSidebarResizeStart}
              className="relative z-[60] w-0 shrink-0 cursor-col-resize before:absolute before:inset-y-0 before:-right-1 before:w-2 before:content-[''] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-transparent after:transition-colors after:content-[''] hover:after:bg-[var(--line-subtle)] data-[dragging]:after:bg-[var(--border-color)]"
            />
          )}
          <div
            aria-hidden={!isRightSidebarOpen}
            className="relative z-50 shrink-0 overflow-hidden"
            style={{
              width: isRightSidebarOpen ? draftRightSidebarWidth : 0,
              pointerEvents: isRightSidebarOpen ? "auto" : "none",
              transition: isSidebarDragging ? "none" : "width 140ms ease-out",
            }}
          >
            <div
              style={{ width: draftRightSidebarWidth }}
              className={`h-full ${isRightSidebarOpen ? "" : "invisible"}`}
            >
              <RightSidebar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
