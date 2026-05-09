import { getCurrentWebview, type DragDropEvent } from "@tauri-apps/api/webview";
import type { UnlistenFn } from "@tauri-apps/api/event";

export interface NativeFileDropPayload {
  type?: DragDropEvent["type"];
  paths?: string[];
  position?:
    | { x: number; y: number }
    | { Physical: { x: number; y: number } }
    | { Logical: { x: number; y: number } };
}

function extractPoint(position: NativeFileDropPayload["position"]) {
  if (!position) return null;
  if ("x" in position && "y" in position) return position;
  if ("Logical" in position) return position.Logical;
  if ("Physical" in position) return position.Physical;
  return null;
}

export function getNativeDropPaths(payload: NativeFileDropPayload): string[] {
  return Array.isArray(payload.paths) ? payload.paths.filter(Boolean) : [];
}

export function elementFromNativeDrop(payload: NativeFileDropPayload): Element | null {
  return elementsFromNativeDrop(payload)[0] ?? null;
}

export function elementsFromNativeDrop(payload: NativeFileDropPayload): Element[] {
  const elements: Element[] = [];
  const seen = new Set<Element>();
  const addElement = (point: { x: number; y: number } | null) => {
    if (!point) return;
    const element = document.elementFromPoint(point.x, point.y);
    if (!element || seen.has(element)) return;
    seen.add(element);
    elements.push(element);
  };

  const point = cssPointFromNativeDrop(payload);
  addElement(point);

  const raw = extractPoint(payload.position);
  if (!point || !raw || point.x !== raw.x || point.y !== raw.y) {
    addElement(raw);
  }

  return elements;
}

export function cssPointFromNativeDrop(payload: NativeFileDropPayload) {
  const point = extractPoint(payload.position);
  if (!point) return null;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  return { x: point.x / dpr, y: point.y / dpr };
}

export function listenForNativeFileDrops(
  handler: (payload: NativeFileDropPayload) => void,
): Promise<UnlistenFn> {
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== "drop") return;
    handler(event.payload);
  });
}
