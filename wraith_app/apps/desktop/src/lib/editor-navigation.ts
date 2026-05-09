export type EditorLineJumpDetail = {
  path: string;
  lineNumber: number;
};

const EDITOR_LINE_JUMP_EVENT = "wraith:editor-line-jump";

export function jumpToEditorLine(path: string, lineNumber: number) {
  window.dispatchEvent(
    new CustomEvent<EditorLineJumpDetail>(EDITOR_LINE_JUMP_EVENT, {
      detail: { path, lineNumber },
    }),
  );
}

export function listenForEditorLineJumps(handler: (detail: EditorLineJumpDetail) => void) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<EditorLineJumpDetail>).detail;
    if (!detail || typeof detail.path !== "string" || typeof detail.lineNumber !== "number") {
      return;
    }
    handler(detail);
  };

  window.addEventListener(EDITOR_LINE_JUMP_EVENT, listener);
  return () => window.removeEventListener(EDITOR_LINE_JUMP_EVENT, listener);
}
