import { create } from "zustand";

export type CommandPaletteIntent = "search" | "create-file";
export type RightSidebarView = "agent" | "terminal" | "git" | "properties" | "outline";

interface UIState {
  isCommandPaletteOpen: boolean;
  commandPaletteIntent: CommandPaletteIntent;
  commandPaletteSearch: string;
  isRightSidebarOpen: boolean;
  rightSidebarWidth: number;
  rightSidebarView: RightSidebarView;
  isSplitView: boolean;

  openCommandPalette: (intent?: CommandPaletteIntent) => void;
  closeCommandPalette: () => void;
  setCommandPaletteSearch: (search: string) => void;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
  setRightSidebarWidth: (width: number) => void;
  setRightSidebarView: (view: RightSidebarView) => void;
  toggleSplitView: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCommandPaletteOpen: false,
  commandPaletteIntent: "search",
  commandPaletteSearch: "",
  isRightSidebarOpen: true,
  rightSidebarWidth: 320,
  rightSidebarView: "agent",
  isSplitView: false,

  openCommandPalette: (intent = "search") =>
    set({ isCommandPaletteOpen: true, commandPaletteIntent: intent, commandPaletteSearch: "" }),
  closeCommandPalette: () =>
    set({
      isCommandPaletteOpen: false,
      commandPaletteIntent: "search",
      commandPaletteSearch: "",
    }),
  setCommandPaletteSearch: (search: string) => set({ commandPaletteSearch: search }),
  toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
  setRightSidebarOpen: (open: boolean) => set({ isRightSidebarOpen: open }),
  setRightSidebarWidth: (width: number) => set({ rightSidebarWidth: width }),
  setRightSidebarView: (view: RightSidebarView) => set({ rightSidebarView: view }),
  toggleSplitView: () => set((state) => ({ isSplitView: !state.isSplitView })),
}));
