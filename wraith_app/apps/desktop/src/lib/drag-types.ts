export const WRAITH_FILE_TREE_DRAG_TYPE = "application/x-wraith-file-tree-entry";
export const WRAITH_FILE_TREE_POINTER_DRAG_MOVE_EVENT = "wraith:file-tree-pointer-drag-move";
export const WRAITH_FILE_TREE_POINTER_DRAG_END_EVENT = "wraith:file-tree-pointer-drag-end";
export const WRAITH_FILE_TREE_POINTER_DRAG_CANCEL_EVENT = "wraith:file-tree-pointer-drag-cancel";

export type WraithFileTreeDragPayload = {
  path: string;
  fileKind: "markdown" | "image" | "pdf";
};

export type WraithFileTreePointerDragDetail = {
  payload: WraithFileTreeDragPayload;
  clientX: number;
  clientY: number;
};

let currentFileTreeDrag: WraithFileTreeDragPayload | null = null;

export function setCurrentFileTreeDrag(payload: WraithFileTreeDragPayload) {
  currentFileTreeDrag = payload;
}

export function getCurrentFileTreeDrag() {
  return currentFileTreeDrag;
}

export function clearCurrentFileTreeDrag() {
  currentFileTreeDrag = null;
}

function emitPointerDrag(eventName: string, clientX: number, clientY: number) {
  if (typeof window === "undefined" || !currentFileTreeDrag) return;
  window.dispatchEvent(
    new CustomEvent<WraithFileTreePointerDragDetail>(eventName, {
      detail: { payload: currentFileTreeDrag, clientX, clientY },
    }),
  );
}

export function beginFileTreePointerDrag(
  payload: WraithFileTreeDragPayload,
  clientX: number,
  clientY: number,
) {
  setCurrentFileTreeDrag(payload);
  emitPointerDrag(WRAITH_FILE_TREE_POINTER_DRAG_MOVE_EVENT, clientX, clientY);
}

export function moveFileTreePointerDrag(clientX: number, clientY: number) {
  emitPointerDrag(WRAITH_FILE_TREE_POINTER_DRAG_MOVE_EVENT, clientX, clientY);
}

export function endFileTreePointerDrag(clientX: number, clientY: number) {
  emitPointerDrag(WRAITH_FILE_TREE_POINTER_DRAG_END_EVENT, clientX, clientY);
  clearCurrentFileTreeDrag();
}

export function cancelFileTreePointerDrag() {
  if (typeof window !== "undefined" && currentFileTreeDrag) {
    window.dispatchEvent(new CustomEvent(WRAITH_FILE_TREE_POINTER_DRAG_CANCEL_EVENT));
  }
  clearCurrentFileTreeDrag();
}
