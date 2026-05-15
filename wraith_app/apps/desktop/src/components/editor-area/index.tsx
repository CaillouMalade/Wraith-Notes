import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  useActiveTab,
  useActiveTabId,
  useOpenTabs,
  useSetActiveSplitPane,
  useSplitViewEnabled,
  useSplitPaneActiveTabId,
  useSplitPaneTabIds,
  type SplitPaneId,
} from "@/hooks/use-tabs";
import { openAssetInPane, openFileInPane } from "@/hooks/editor-api";
import { pageKind } from "./page-kinds";
import { EditorSearchOverlay } from "./editor-search-overlay";
import { EditorTabs } from "./editor-tabs";
import { useSidebar } from "@/hooks/use-sidebar";
import {
  getCurrentFileTreeDrag,
  WRAITH_FILE_TREE_DRAG_TYPE,
  WRAITH_FILE_TREE_POINTER_DRAG_CANCEL_EVENT,
  WRAITH_FILE_TREE_POINTER_DRAG_END_EVENT,
  WRAITH_FILE_TREE_POINTER_DRAG_MOVE_EVENT,
  type WraithFileTreeDragPayload,
  type WraithFileTreePointerDragDetail,
} from "@/lib/drag-types";

function clampSplitRatio(value: number) {
  return Math.max(0.25, Math.min(0.75, value));
}

function EditorArea() {
  const activeTab = useActiveTab();
  const activeTabId = useActiveTabId();
  const tabs = useOpenTabs();
  const isSplitView = useSplitViewEnabled();
  const splitPaneTabIds = useSplitPaneTabIds();
  const splitPaneActiveTabId = useSplitPaneActiveTabId();
  const setActiveSplitPane = useSetActiveSplitPane();
  const { isSidebarCollapsed } = useSidebar();
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const editorDropRootRef = useRef<HTMLDivElement>(null);
  const splitRatioRef = useRef(0.5);
  const splitDropDepthRef = useRef(0);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [splitDropPane, setSplitDropPane] = useState<SplitPaneId | null>(null);
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  const splitTabs = {
    left: splitPaneTabIds.left.map((id) => tabsById.get(id)).filter((tab): tab is (typeof tabs)[number] => Boolean(tab)),
    right: splitPaneTabIds.right.map((id) => tabsById.get(id)).filter((tab): tab is (typeof tabs)[number] => Boolean(tab)),
  };

  function renderTab(tab: (typeof tabs)[number], isActive: boolean) {
    const k = pageKind(tab.location);
    const Component = k.Component as React.ComponentType<{
      location: typeof tab.location;
      isActive: boolean;
    }>;
    return <Component key={tab.id} location={tab.location} isActive={isActive} />;
  }

  const handleSplitResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const container = splitContainerRef.current;
    if (!container) return;

    event.preventDefault();
    setIsDraggingSplit(true);

    const startX = event.clientX;
    const startRatio = splitRatioRef.current;
    const width = Math.max(1, container.getBoundingClientRect().width);
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
      setIsDraggingSplit(false);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const next = clampSplitRatio(startRatio + (moveEvent.clientX - startX) / width);
      splitRatioRef.current = next;
      setSplitRatio(next);
    };

    const handlePointerUp = () => cleanup();
    const handlePointerCancel = () => {
      splitRatioRef.current = startRatio;
      setSplitRatio(startRatio);
      cleanup();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
  }, []);

  const hasFileTreeDrag = useCallback((event: DragEvent<HTMLElement>) => {
    return (
      Array.from(event.dataTransfer.types).includes(WRAITH_FILE_TREE_DRAG_TYPE) ||
      getCurrentFileTreeDrag() !== null
    );
  }, []);

  const paneFromClientX = useCallback(
    (clientX: number): SplitPaneId => {
      if (!splitContainerRef.current || !isSplitView) return "right";
      const rect = splitContainerRef.current.getBoundingClientRect();
      return clientX < rect.left + rect.width / 2 ? "left" : "right";
    },
    [isSplitView],
  );

  const parseFileTreeDrop = useCallback((event: DragEvent<HTMLElement>) => {
    try {
      const raw = event.dataTransfer.getData(WRAITH_FILE_TREE_DRAG_TYPE);
      if (!raw) return getCurrentFileTreeDrag();
      return JSON.parse(raw) as WraithFileTreeDragPayload;
    } catch {
      return getCurrentFileTreeDrag();
    }
  }, []);

  const clearSplitDrop = useCallback(() => {
    splitDropDepthRef.current = 0;
    setSplitDropPane(null);
  }, []);

  const isInsideEditorDropRoot = useCallback((clientX: number, clientY: number) => {
    const rect = editorDropRootRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }, []);

  const openSplitPayload = useCallback((payload: WraithFileTreeDragPayload, pane: SplitPaneId) => {
    if (payload.fileKind === "markdown") {
      void openFileInPane(payload.path, pane).catch((error: unknown) => {
        window.alert(
          `Failed to open in split: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
      return;
    }
    openAssetInPane(payload.path, payload.fileKind, pane);
  }, []);

  const handleSplitDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!hasFileTreeDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const payload = parseFileTreeDrop(event);
      const pane = paneFromClientX(event.clientX);
      clearSplitDrop();
      if (!payload) return;

      openSplitPayload(payload, pane);
    },
    [clearSplitDrop, hasFileTreeDrag, openSplitPayload, paneFromClientX, parseFileTreeDrop],
  );

  useEffect(() => {
    const dragDetail = (event: Event) =>
      (event as CustomEvent<WraithFileTreePointerDragDetail>).detail ?? null;

    const handlePointerDragMove = (event: Event) => {
      const detail = dragDetail(event);
      if (!detail || !isInsideEditorDropRoot(detail.clientX, detail.clientY)) {
        setSplitDropPane(null);
        return;
      }
      setSplitDropPane(paneFromClientX(detail.clientX));
    };

    const handlePointerDragEnd = (event: Event) => {
      const detail = dragDetail(event);
      clearSplitDrop();
      if (!detail || !isInsideEditorDropRoot(detail.clientX, detail.clientY)) return;
      openSplitPayload(detail.payload, paneFromClientX(detail.clientX));
    };

    const handlePointerDragCancel = () => clearSplitDrop();

    window.addEventListener(WRAITH_FILE_TREE_POINTER_DRAG_MOVE_EVENT, handlePointerDragMove);
    window.addEventListener(WRAITH_FILE_TREE_POINTER_DRAG_END_EVENT, handlePointerDragEnd);
    window.addEventListener(WRAITH_FILE_TREE_POINTER_DRAG_CANCEL_EVENT, handlePointerDragCancel);

    return () => {
      window.removeEventListener(WRAITH_FILE_TREE_POINTER_DRAG_MOVE_EVENT, handlePointerDragMove);
      window.removeEventListener(WRAITH_FILE_TREE_POINTER_DRAG_END_EVENT, handlePointerDragEnd);
      window.removeEventListener(WRAITH_FILE_TREE_POINTER_DRAG_CANCEL_EVENT, handlePointerDragCancel);
    };
  }, [clearSplitDrop, isInsideEditorDropRoot, openSplitPayload, paneFromClientX]);

  function renderPane(pane: SplitPaneId) {
    const paneTabs = splitTabs[pane];
    const paneActiveId = splitPaneActiveTabId[pane] ?? paneTabs[0]?.id ?? null;
    const paneChromeLeft = pane === "left" && isSidebarCollapsed ? 132 : 12;
    return (
      <div
        className="wraith-split-pane relative h-full min-h-0 min-w-0 overflow-hidden"
        onMouseDown={() => setActiveSplitPane(pane)}
      >
        <div
          data-tauri-drag-region
          className="pointer-events-none absolute right-3 top-0 z-40"
          style={{ left: paneChromeLeft }}
        >
          <div className="pointer-events-auto">
            <EditorTabs tabsOverride={paneTabs} activeTabIdOverride={paneActiveId} pane={pane} />
          </div>
        </div>
        {paneTabs.map((tab) => {
          const k = pageKind(tab.location);
          const isActive = tab.id === paneActiveId;
          if (!k.keepAlive && !isActive) return null;
          return renderTab(tab, isActive);
        })}
      </div>
    );
  }

  return (
    <div
      ref={editorDropRootRef}
      className="relative h-full overflow-hidden"
      onDragEnter={(event) => {
        if (!hasFileTreeDrag(event)) return;
        event.preventDefault();
        splitDropDepthRef.current += 1;
        setSplitDropPane(paneFromClientX(event.clientX));
      }}
      onDragOver={(event) => {
        if (!hasFileTreeDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setSplitDropPane(paneFromClientX(event.clientX));
      }}
      onDragLeave={(event) => {
        if (!hasFileTreeDrag(event)) return;
        splitDropDepthRef.current = Math.max(0, splitDropDepthRef.current - 1);
        if (splitDropDepthRef.current === 0) setSplitDropPane(null);
      }}
      onDrop={handleSplitDrop}
    >
      {isSplitView && splitTabs.left.length > 0 && splitTabs.right.length > 0 ? (
        <div
          ref={splitContainerRef}
          className="grid h-full min-h-0 overflow-hidden"
          style={{
            gridTemplateColumns: `${splitRatio}fr 0 ${1 - splitRatio}fr`,
            transition: isDraggingSplit
              ? "none"
              : "grid-template-columns var(--motion-chrome-duration) var(--motion-soft-ease)",
          }}
        >
          <div className="relative h-full min-h-0 min-w-0 overflow-hidden border-r border-[var(--line-subtle)]">
            {renderPane("left")}
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuemin={25}
            aria-valuemax={75}
            aria-valuenow={Math.round(splitRatio * 100)}
            data-dragging={isDraggingSplit || undefined}
            onPointerDown={handleSplitResizeStart}
            className="relative z-30 w-0 cursor-col-resize before:absolute before:inset-y-0 before:-left-1 before:w-2 before:content-[''] after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-transparent after:transition-colors after:content-[''] hover:after:bg-[var(--line-subtle)] data-[dragging]:after:bg-[var(--border-color)]"
          />
          <div className="relative h-full min-h-0 min-w-0 overflow-hidden">
            {renderPane("right")}
          </div>
        </div>
      ) : (
        <div className="relative h-full min-h-0 overflow-hidden">
          {tabs.map((tab) => {
            const k = pageKind(tab.location);
            const isActive = tab.id === activeTabId;
            if (!k.keepAlive && !isActive) return null;
            return renderTab(tab, isActive);
          })}
        </div>
      )}
      {splitDropPane ? (
        <div
          className={`pointer-events-none absolute inset-y-0 z-[45] flex items-center justify-center p-4 ${
            splitDropPane === "left" ? "left-0 right-1/2" : "left-1/2 right-0"
          }`}
        >
          <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[0.8125rem] text-[var(--text-secondary)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_22%,transparent)] backdrop-blur-sm">
            Open in {splitDropPane} split
          </div>
        </div>
      ) : null}
      {activeTab ? pageKind(activeTab.location).renderFooter?.(activeTab.location) : null}
      <EditorSearchOverlay />
    </div>
  );
}

export { EditorArea };
