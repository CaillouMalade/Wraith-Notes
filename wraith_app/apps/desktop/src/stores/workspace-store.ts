import { create } from "zustand";
import type { DirEntry } from "@/types/fs";
import type { RestoreWorkspaceResponse } from "@/lib/tauri";
import * as tauri from "@/lib/tauri";
import { saveSession, loadSession } from "@/lib/session";
import { getEditorSessionSnapshot, useEditorStore } from "@/stores/editor-store";

interface WorkspaceState {
  root: string | null;
  isIndexing: boolean;
  isStartupResolved: boolean;
  directoryCache: Map<string, DirEntry[]>;
  expandedDirs: Set<string>;
  recentWorkspaces: string[];

  openWorkspace: (path: string) => Promise<void>;
  /** Hydrate from a prefetched `RestoreWorkspaceResponse` (startup cold-path
   *  and user-initiated switches via the `restore_workspace` IPC). */
  restoreFromBundle: (bundle: RestoreWorkspaceResponse) => Promise<void>;
  closeWorkspace: () => void;
  setStartupResolved: () => void;
  refreshDirectory: (path: string) => Promise<void>;
  toggleDirectory: (path: string) => Promise<void>;
  invalidatePath: (path: string) => void;
  rewriteExpandedDir: (oldPath: string, newPath: string) => void;
  removeRecentWorkspace: (path: string) => Promise<void>;
}

async function buildExpandedDirectoryState(
  root: string,
  dirs: string[],
  initialCache: Map<string, DirEntry[]>,
) {
  const normalizedRoot = root.replace(/\/$/, "");
  const rootPrefix = `${normalizedRoot}/`;
  const candidates = [...new Set(dirs)]
    .map((dir) => dir.trim())
    .filter((dir) => dir.length > 0 && dir !== normalizedRoot && dir.startsWith(rootPrefix));

  const cache = new Map(initialCache);
  const expandedDirs = new Set<string>();
  const loaded = await Promise.all(
    candidates.map(async (dir) => {
      try {
        return [dir, await tauri.readDirectory(dir)] as const;
      } catch {
        return null;
      }
    }),
  );

  for (const entry of loaded) {
    if (!entry) continue;
    const [dir, entries] = entry;
    cache.set(dir, entries);
    expandedDirs.add(dir);
  }

  return { directoryCache: cache, expandedDirs };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  root: null,
  isIndexing: false,
  isStartupResolved: false,
  directoryCache: new Map(),
  expandedDirs: new Set(),
  recentWorkspaces: [],

  openWorkspace: async (path: string) => {
    // Multi-window: when this window already has a workspace, open the new
    // one in a fresh in-process window instead of replacing the current
    // workspace. Each window has its own `WorkspaceState` on the Rust side
    // so file watchers, search indexes, and session state stay isolated.
    const prevRoot = get().root;
    if (prevRoot && prevRoot !== path) {
      await tauri.openWorkspaceInNewWindow(path);
      return;
    }
    if (prevRoot === path) {
      return;
    }

    // Clear editor state before switching
    useEditorStore.setState({
      openFiles: new Map(),
      tabs: [],
      activeTabId: null,
      activeFilePath: null,
      splitViewEnabled: false,
      activeSplitPane: "left",
      splitPaneTabIds: { left: [], right: [] },
      splitPaneActiveTabId: { left: null, right: null },
    });

    const info = await tauri.openWorkspace(path);
    const entries = await tauri.readDirectory(path);
    const recents = await tauri.getRecentWorkspaces();
    const session = await loadSession(path);
    const restoredTree = await buildExpandedDirectoryState(
      info.root,
      session?.expandedDirs ?? [],
      new Map([[info.root, entries]]),
    );

    set({
      root: info.root,
      isIndexing: true,
      directoryCache: restoredTree.directoryCache,
      expandedDirs: restoredTree.expandedDirs,
      recentWorkspaces: recents,
    });

    // Restore session for the new workspace
    if (session && session.tabs.length > 0) {
      await useEditorStore.getState().restoreSession(session.tabs, session.activeIndex);
      return;
    }

    useEditorStore.getState().ensureLauncherTab();
  },

  closeWorkspace: () => {
    const root = get().root;
    if (!root) return;
    const snapshot = getEditorSessionSnapshot(useEditorStore.getState());
    void saveSession(root, snapshot.tabs, snapshot.activeIndex, [...get().expandedDirs]);
    useEditorStore.setState({
      openFiles: new Map(),
      tabs: [],
      activeTabId: null,
      activeFilePath: null,
      splitViewEnabled: false,
      activeSplitPane: "left",
      splitPaneTabIds: { left: [], right: [] },
      splitPaneActiveTabId: { left: null, right: null },
    });
    set({ root: null, directoryCache: new Map(), expandedDirs: new Set(), isIndexing: false });
  },

  restoreFromBundle: async (bundle) => {
    // Clear editor state in case anything was hydrated by a parallel hook.
    useEditorStore.setState({
      openFiles: new Map(),
      tabs: [],
      activeTabId: null,
      activeFilePath: null,
      splitViewEnabled: false,
      activeSplitPane: "left",
      splitPaneTabIds: { left: [], right: [] },
      splitPaneActiveTabId: { left: null, right: null },
    });

    const restoredTree = await buildExpandedDirectoryState(
      bundle.workspace.root,
      bundle.session?.expanded_dirs ?? [],
      new Map([[bundle.workspace.root, bundle.entries]]),
    );

    set({
      root: bundle.workspace.root,
      isIndexing: true,
      directoryCache: restoredTree.directoryCache,
      expandedDirs: restoredTree.expandedDirs,
      recentWorkspaces: bundle.recent_workspaces,
    });

    if (bundle.session && bundle.session.tabs && bundle.session.tabs.length > 0) {
      // Fire-and-forget: `restoreSession` populates the active tab
      // synchronously (via prefetchedActiveFile) before it starts awaiting
      // background tab reads. We intentionally don't await the whole thing
      // so the startup flow doesn't block on tabs the user isn't looking at
      // yet — they load in the background and fill in on their own.
      void useEditorStore
        .getState()
        .restoreSession(
          bundle.session.tabs,
          bundle.session.active_index ?? null,
          bundle.active_file,
        )
        .catch((error) => {
          console.error("Failed to load background tabs from restored session", error);
        });
      return;
    }

    useEditorStore.getState().ensureLauncherTab();
  },

  setStartupResolved: () => set({ isStartupResolved: true }),

  refreshDirectory: async (path: string) => {
    const entries = await tauri.readDirectory(path);
    set((state) => {
      const cache = new Map(state.directoryCache);
      cache.set(path, entries);
      return { directoryCache: cache };
    });
  },

  toggleDirectory: async (path: string) => {
    const { expandedDirs, directoryCache } = get();
    const newExpanded = new Set(expandedDirs);

    if (newExpanded.has(path)) {
      newExpanded.delete(path);
      set({ expandedDirs: newExpanded });
    } else {
      newExpanded.add(path);
      if (!directoryCache.has(path)) {
        const entries = await tauri.readDirectory(path);
        set((state) => {
          const cache = new Map(state.directoryCache);
          cache.set(path, entries);
          return { directoryCache: cache, expandedDirs: newExpanded };
        });
      } else {
        set({ expandedDirs: newExpanded });
      }
    }
  },

  invalidatePath: (path: string) => {
    set((state) => {
      const cache = new Map(state.directoryCache);
      cache.delete(path);
      const expandedDirs = new Set<string>();
      const dirPrefix = `${path}/`;
      let changed = false;
      for (const dir of state.expandedDirs) {
        if (dir !== path && !dir.startsWith(dirPrefix)) {
          expandedDirs.add(dir);
        } else {
          changed = true;
        }
      }
      return changed ? { directoryCache: cache, expandedDirs } : { directoryCache: cache };
    });
  },

  rewriteExpandedDir: (oldPath: string, newPath: string) => {
    set((state) => {
      const dirPrefix = `${oldPath}/`;
      const next = new Set<string>();
      let changed = false;

      for (const dir of state.expandedDirs) {
        if (dir === oldPath) {
          next.add(newPath);
          changed = true;
        } else if (dir.startsWith(dirPrefix)) {
          next.add(newPath + dir.slice(oldPath.length));
          changed = true;
        } else {
          next.add(dir);
        }
      }

      if (!changed) return state;

      // Also rekey directory cache entries under the old prefix
      const cache = new Map<string, DirEntry[]>();
      for (const [key, entries] of state.directoryCache) {
        if (key === oldPath) {
          cache.set(newPath, entries);
        } else if (key.startsWith(dirPrefix)) {
          cache.set(newPath + key.slice(oldPath.length), entries);
        } else {
          cache.set(key, entries);
        }
      }

      return { expandedDirs: next, directoryCache: cache };
    });
  },

  removeRecentWorkspace: async (path: string) => {
    await tauri.removeRecentWorkspace(path);
    set((state) => ({
      recentWorkspaces: state.recentWorkspaces.filter((p) => p !== path),
    }));
  },
}));

// Recent workspaces are hydrated by resolveStartup() via get_startup_state before the first render.

// Save session whenever tabs change (debounced) and on window close
if (typeof window !== "undefined") {
  let sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function saveCurrentSession() {
    const workspace = useWorkspaceStore.getState();
    const root = workspace.root;
    if (!root) return;
    const snapshot = getEditorSessionSnapshot(useEditorStore.getState());
    void saveSession(root, snapshot.tabs, snapshot.activeIndex, [...workspace.expandedDirs].sort());
  }

  function scheduleSessionSave() {
    if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
    sessionSaveTimer = setTimeout(saveCurrentSession, 500);
  }

  useEditorStore.subscribe((state, prev) => {
    if (state.tabs === prev.tabs && state.activeTabId === prev.activeTabId) return;
    scheduleSessionSave();
  });

  useWorkspaceStore.subscribe((state, prev) => {
    if (state.expandedDirs === prev.expandedDirs) return;
    if (!state.root || state.root !== prev.root) return;
    scheduleSessionSave();
  });

  window.addEventListener("beforeunload", () => {
    if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
    saveCurrentSession();
  });
}
