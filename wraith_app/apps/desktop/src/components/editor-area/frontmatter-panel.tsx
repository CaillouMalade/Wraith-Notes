import { useCallback, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useFrontmatterEntries } from "./use-frontmatter-entries";
import * as editorApi from "@/hooks/editor-api";
import { getWorkspaceRoot } from "@/hooks/workspace-api";
import { parseFrontmatterLinks, hasFrontmatterLinks } from "@/lib/frontmatter-links";
import { resolveWikiLink } from "@/lib/wiki-links";
import * as tauri from "@/lib/tauri";
import type { YamlEntry } from "@/lib/yaml-entries";

interface FrontmatterPanelProps {
  filePath: string;
}

interface FrontmatterRowProps {
  entry: YamlEntry;
  index: number;
  onUpdate: (index: number, field: "key" | "value", value: string) => void;
  onRemove: (index: number) => void;
  onBlur: (index: number) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>, index: number, field: "key" | "value") => void;
}

function FrontmatterRow({
  entry,
  index,
  onUpdate,
  onRemove,
  onBlur,
  onKeyDown,
}: FrontmatterRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isValueFocused, setIsValueFocused] = useState(false);

  // Autofocus the key input only for placeholder rows — i.e. a seeded empty row
  // on fresh panel mount, or a new row appended via Add Property. React evaluates
  // `autoFocus` on input mount; committed rows keep the prop false and never
  // steal focus on re-renders.
  const isPlaceholder = entry.key === "" && entry.value === "";

  // Blurs that move focus to another field in the same row (Tab from key to
  // value) should not trigger blur-cleanup. Filter those out via relatedTarget.
  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && rowRef.current?.contains(next)) return;
      setIsValueFocused(false);
      onBlur(index);
    },
    [index, onBlur],
  );

  const showValueLinks = !isValueFocused && hasFrontmatterLinks(entry.value);
  const valueParts = showValueLinks ? parseFrontmatterLinks(entry.value) : [];

  const followFrontmatterLink = useCallback(async (raw: string) => {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) return;
    const target = await resolveWikiLink(raw, workspaceRoot, tauri.fuzzySearch, tauri.fileExists);
    if (target.kind === "internal") {
      await editorApi.navigateToFile(target.path);
    }
  }, []);

  return (
    <div
      ref={rowRef}
      className="group -mx-3 flex items-center gap-4 rounded-lg px-3 py-1.5 focus-within:bg-[var(--surface-subtle)]"
    >
      <input
        data-field="key"
        type="text"
        value={entry.key}
        onChange={(e) => onUpdate(index, "key", e.target.value)}
        onKeyDown={(e) => onKeyDown(e, index, "key")}
        onBlur={handleBlur}
        autoFocus={isPlaceholder}
        placeholder="key"
        spellCheck={false}
        className="w-36 shrink-0 bg-transparent text-[13px] leading-[1.15] text-[var(--text-muted)] outline-none placeholder:text-[var(--text-muted)] placeholder:opacity-70"
      />

      <div className="relative min-w-0 flex-1">
        {showValueLinks && (
          <div className="pointer-events-none absolute inset-0 flex min-w-0 items-center gap-1 overflow-hidden text-[13px] leading-[1.15] text-[var(--text-primary)]">
            {valueParts.map((part, partIndex) =>
              part.kind === "text" ? (
                <span key={partIndex} className="whitespace-pre">
                  {part.text}
                </span>
              ) : (
                <button
                  key={partIndex}
                  type="button"
                  className="pointer-events-auto max-w-[12rem] truncate rounded-md bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[12px] text-[var(--accent)] hover:bg-[var(--surface-selected)]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    void followFrontmatterLink(part.raw);
                  }}
                >
                  {part.label}
                </button>
              ),
            )}
          </div>
        )}
        <input
          data-field="value"
          type="text"
          value={entry.value}
          onFocus={() => setIsValueFocused(true)}
          onChange={(e) => onUpdate(index, "value", e.target.value)}
          onKeyDown={(e) => onKeyDown(e, index, "value")}
          onBlur={handleBlur}
          placeholder="value"
          spellCheck={false}
          className={`min-w-0 flex-1 bg-transparent text-[13px] leading-[1.15] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] placeholder:opacity-70 ${showValueLinks ? "opacity-0" : ""}`}
        />
      </div>

      <button
        type="button"
        onClick={() => onRemove(index)}
        aria-label="Remove property"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--text-icon-muted)] opacity-0 transition-opacity hover:text-[var(--text-primary)] group-hover:opacity-100"
        tabIndex={-1}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 2l6 6M8 2l-6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

export function FrontmatterPanel({ filePath }: FrontmatterPanelProps) {
  const { entries, updateEntry, removeEntry, addEntry, blurEntry, hasFrontmatter } =
    useFrontmatterEntries(filePath);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, index: number, field: "key" | "value") => {
      if (e.key === "Enter" && field === "value" && index === entries.length - 1) {
        e.preventDefault();
        addEntry();
        // autoFocus on the newly-mounted empty row handles focus — no RAF needed.
        return;
      }
      if (e.key === "Backspace" && entries[index]?.key === "" && entries[index]?.value === "") {
        e.preventDefault();
        removeEntry(index);
      }
    },
    [entries, addEntry, removeEntry],
  );

  if (!hasFrontmatter) return null;

  return (
    <div ref={containerRef} data-frontmatter className="space-y-2 pb-6">
      <div className="flex flex-col gap-1.5">
        {entries.map((entry, index) => (
          <FrontmatterRow
            key={index}
            entry={entry}
            index={index}
            onUpdate={updateEntry}
            onRemove={removeEntry}
            onBlur={blurEntry}
            onKeyDown={handleKeyDown}
          />
        ))}
      </div>

      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-1 text-[13px] leading-[1.15] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add property
        </button>
      </div>
    </div>
  );
}
