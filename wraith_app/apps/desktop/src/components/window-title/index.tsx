import { useActiveFilePath, useActiveTab, useOpenFiles } from "@/hooks/use-tabs";
import { pageKind } from "@/components/editor-area/page-kinds";
import { getFileName } from "@/lib/paths";
import { useWindowTitle } from "./use-window-title";

export function WindowTitle() {
  const activeTab = useActiveTab();
  const activeFilePath = useActiveFilePath();
  const openFiles = useOpenFiles();

  const title = (() => {
    if (!activeTab) return "Wraith";
    if (!activeFilePath) {
      const label = pageKind(activeTab.location).title(activeTab.location);
      return `${label} - Wraith`;
    }
    const file = openFiles.get(activeFilePath);
    const name = getFileName(activeFilePath);
    return file?.isDirty ? `${name} (unsaved) - Wraith` : `${name} - Wraith`;
  })();

  useWindowTitle(title);

  return null;
}
