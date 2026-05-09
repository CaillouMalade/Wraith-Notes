import { useEffect } from "react";
import { useUIStore } from "@/stores/ui-store";
import { useEditorStore } from "@/stores/editor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toggleSidebar } from "@/hooks/use-sidebar";
import { eventMatchesShortcut, getShortcutValue, type ShortcutSettingKey } from "@/lib/keyboard-shortcuts";

function isEditableTargetFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return true;
  if ((active as HTMLElement).isContentEditable) return true;
  // CodeMirror editors render a contenteditable inside .cm-editor
  return active.closest(".cm-editor") !== null;
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const settings = useSettingsStore.getState().settings;
      const matches = (key: ShortcutSettingKey) =>
        eventMatchesShortcut(e, getShortcutValue(settings, key));

      // Read current state at event time
      const { openCommandPalette } = useUIStore.getState();
      const { root } = useWorkspaceStore.getState();
      const {
        tabs,
        activeTabId,
        setActiveTab,
        openNewTab,
        closeActiveTab,
        navigateBack,
        navigateForward,
      } = useEditorStore.getState();

      // Alt+Arrow: history navigation when no editable target is focused;
      // inside the editor, let CodeMirror handle word-wise cursor motion.
      if (matches("shortcuts.navigate-back") && !isEditableTargetFocused()) {
        e.preventDefault();
        void navigateBack();
        return;
      }

      if (matches("shortcuts.navigate-forward") && !isEditableTargetFocused()) {
        e.preventDefault();
        void navigateForward();
        return;
      }

      // Cmd+P / Cmd+Shift+P — unified search (files + commands)
      if (matches("shortcuts.search")) {
        e.preventDefault();
        if (root) openCommandPalette("search");
        return;
      }

      if (matches("shortcuts.command-palette")) {
        e.preventDefault();
        openCommandPalette("search");
        return;
      }

      // Cmd+W — close current tab
      if (matches("shortcuts.close-tab")) {
        e.preventDefault();
        if (activeTabId) closeActiveTab();
        return;
      }

      // Cmd+\ — toggle sidebar
      if (matches("shortcuts.toggle-right-sidebar")) {
        e.preventDefault();
        useUIStore.getState().toggleRightSidebar();
        return;
      }

      if (matches("shortcuts.toggle-sidebar")) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Cmd+N — create new note
      if (matches("shortcuts.new-note")) {
        e.preventDefault();
        if (root) openCommandPalette("create-file");
        return;
      }

      // Cmd+O — go to file
      if (matches("shortcuts.go-to-file")) {
        e.preventDefault();
        if (root) openCommandPalette("search");
        return;
      }

      // Cmd+T — new tab
      if (matches("shortcuts.new-tab")) {
        e.preventDefault();
        if (root) openNewTab();
        return;
      }

      // Cmd+Shift+S — split center editor area
      if (matches("shortcuts.toggle-split-view")) {
        e.preventDefault();
        useUIStore.getState().toggleSplitView();
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab — cycle tabs
      if (matches("shortcuts.next-tab") || matches("shortcuts.previous-tab")) {
        e.preventDefault();
        if (tabs.length === 0 || !activeTabId) return;
        const idx = tabs.findIndex((tab) => tab.id === activeTabId);
        if (idx === -1) return;
        const previous = matches("shortcuts.previous-tab");
        const next = previous ? (idx - 1 + tabs.length) % tabs.length : (idx + 1) % tabs.length;
        setActiveTab(tabs[next]!.id);
        return;
      }

      // Cmd+1 through Cmd+9 — jump to Nth tab
      if (mod && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const n = parseInt(e.key) - 1;
        if (n < tabs.length) {
          setActiveTab(tabs[n]!.id);
        }
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
