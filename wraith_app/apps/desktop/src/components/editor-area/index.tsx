import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  useActiveTab,
  useActiveTabId,
  useOpenTabs,
  useSetActiveSplitPane,
  useSplitPaneActiveTabId,
  useSplitPaneTabIds,
  useSplitViewEnabled,
  type SplitPaneId,
} from "@/hooks/use-tabs";
import { pageKind } from "./page-kinds";
import { EditorSearchOverlay } from "./editor-search-overlay";
import { EditorTabs } from "./editor-tabs";
import { useSidebar } from "@/hooks/use-sidebar";

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
  const splitRatioRef = useRef(0.5);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
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

  function renderPane(pane: SplitPaneId) {
    const paneTabs = splitTabs[pane];
    const paneActiveId = splitPaneActiveTabId[pane] ?? paneTabs[0]?.id ?? null;
    const paneChromeLeft = pane === "left" && isSidebarCollapsed ? 132 : 12;
    return (
      <div
        className="relative h-full min-h-0 min-w-0 overflow-hidden"
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
    <div className="relative h-full overflow-hidden">
      {isSplitView && splitTabs.left.length > 0 && splitTabs.right.length > 0 ? (
        <div
          ref={splitContainerRef}
          className="grid h-full min-h-0 overflow-hidden"
          style={{ gridTemplateColumns: `${splitRatio}fr 0 ${1 - splitRatio}fr` }}
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
      {activeTab ? pageKind(activeTab.location).renderFooter?.(activeTab.location) : null}
      <EditorSearchOverlay />
    </div>
  );
}

export { EditorArea };
