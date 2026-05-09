import {
  getFileExtension,
  getFileName,
  getFileStem,
  getParentDir,
  getRelativePath,
  normalizePath,
} from "./paths";

export type VaultTargetSource =
  | "body-wikilink"
  | "obsidian-embed"
  | "markdown-link"
  | "markdown-image"
  | "frontmatter-value";

export type VaultTargetHint = "note" | "image" | "pdf" | "asset" | "unknown";
export type VaultEntryKind = "note" | "image" | "pdf" | "other-supported-asset";
export type VaultAssetKind = "image" | "pdf";

export interface VaultEntry {
  path: string;
  relativePath: string;
  name: string;
  stem: string;
  extension: string;
  kind: VaultEntryKind;
  title?: string | null;
  aliases?: string[];
}

export interface VaultEntryIndex {
  entries: VaultEntry[];
}

export interface VaultTargetContext {
  workspaceRoot: string;
  currentFilePath: string | null;
  entries: VaultEntryIndex;
}

export interface VaultTargetCandidate {
  path: string;
  relativePath: string;
  kind: VaultEntryKind;
  label: string;
}

export type VaultTargetResolution =
  | {
      kind: "resolved-note";
      path: string;
      relativePath: string;
      fragment: string | null;
      displayText: string;
      entry: VaultEntry;
    }
  | {
      kind: "resolved-asset";
      path: string;
      relativePath: string;
      assetKind: VaultAssetKind;
      displayText: string;
      entry: VaultEntry;
    }
  | { kind: "same-file-fragment"; path: string; fragment: string; displayText: string }
  | { kind: "external-url"; url: string; displayText: string }
  | { kind: "external-path"; path: string; displayText: string }
  | { kind: "ambiguous"; candidates: VaultTargetCandidate[]; reason: string; displayText: string }
  | { kind: "unresolved"; reason: string; displayText: string }
  | { kind: "unsafe"; reason: string; displayText: string };

type ParsedWikiLikeTarget = {
  raw: string;
  target: string;
  path: string;
  fragment: string | null;
  modifier: string | null;
  displayText: string;
};

const NOTE_EXTENSIONS = new Set(["md", "markdown"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tiff"]);
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/;
const EXPLICIT_URL_SCHEME = /^[A-Za-z][A-Za-z\d+.-]*:/;

export function createVaultEntryIndex(entries: VaultEntry[]): VaultEntryIndex {
  return { entries: entries.map(normalizeEntry) };
}

export function vaultEntryFromPath(
  path: string,
  workspaceRoot: string,
  kind: VaultEntryKind = kindFromPath(path),
  extra: Pick<VaultEntry, "title" | "aliases"> = {},
): VaultEntry {
  const name = getFileName(path);
  return normalizeEntry({
    path: normalizePath(path),
    relativePath: getRelativePath(path, workspaceRoot),
    name,
    stem: getFileStem(name),
    extension: getFileExtension(name).toLowerCase(),
    kind,
    ...extra,
  });
}

function normalizeEntry(entry: VaultEntry): VaultEntry {
  const relativePath = normalizeVaultRelative(entry.relativePath) ?? entry.relativePath.replace(/\\/g, "/");
  const name = entry.name || getFileName(relativePath);
  const extension = (entry.extension || getFileExtension(name)).toLowerCase();
  return {
    ...entry,
    path: normalizePath(entry.path),
    relativePath,
    name,
    stem: entry.stem || getFileStem(name),
    extension,
    aliases: entry.aliases ?? [],
  };
}

function kindFromPath(path: string): VaultEntryKind {
  const extension = getFileExtension(path).toLowerCase();
  if (NOTE_EXTENSIONS.has(extension)) return "note";
  if (extension === "pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  return "other-supported-asset";
}

function assetKindFromExtension(extension: string): VaultAssetKind | null {
  if (extension === "pdf") return "pdf";
  return IMAGE_EXTENSIONS.has(extension) ? "image" : null;
}

function assetKindFromTarget(target: string): VaultAssetKind | null {
  return assetKindFromExtension(getFileExtension(stripLinkSuffix(target)).toLowerCase());
}

function decodeLinkPath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function stripLinkSuffix(path: string): string {
  const hashIndex = path.indexOf("#");
  const queryIndex = path.indexOf("?");
  const splitIndex =
    hashIndex === -1 ? queryIndex : queryIndex === -1 ? hashIndex : Math.min(hashIndex, queryIndex);
  return splitIndex === -1 ? path : path.slice(0, splitIndex);
}

function splitFragment(target: string): { path: string; fragment: string | null } {
  const index = findUnescaped(target, "#");
  if (index === -1) return { path: target, fragment: null };
  return { path: target.slice(0, index), fragment: target.slice(index + 1) };
}

function splitModifier(raw: string): { target: string; modifier: string | null } {
  const index = findUnescaped(raw, "|");
  if (index === -1) return { target: raw, modifier: null };
  return {
    target: raw.slice(0, index),
    modifier: unescapeWikiText(raw.slice(index + 1)).trim() || null,
  };
}

function findUnescaped(input: string, char: string): number {
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] === char && input[i - 1] !== "\\") return i;
  }
  return -1;
}

function unescapeWikiText(text: string): string {
  return text.replace(/\\([|#])/g, "$1");
}

function parseWikiLikeTarget(raw: string): ParsedWikiLikeTarget {
  const { target, modifier } = splitModifier(raw.trim());
  const normalizedTarget = unescapeWikiText(target).trim().replace(/\\/g, "/");
  const { path, fragment } = splitFragment(normalizedTarget);
  const displayPath = normalizeNoteLookupPath(path);
  const displayText = modifier || displayPath || (fragment ? `#${fragment}` : normalizedTarget);
  return {
    raw,
    target: normalizedTarget,
    path: displayPath,
    fragment,
    modifier,
    displayText,
  };
}

function normalizeNoteLookupPath(raw: string): string {
  let target = raw.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const lower = target.toLowerCase();
  if (lower.endsWith(".md")) target = target.slice(0, -3);
  if (lower.endsWith(".markdown")) target = target.slice(0, -9);
  return target;
}

function normalizeAssetLookupPath(raw: string): string {
  return stripLinkSuffix(raw).trim().replace(/\\/g, "/").replace(/^\/+/, "");
}

function normalizeVaultRelative(relativePath: string): string | null {
  const normalized = normalizePath(relativePath.replace(/\\/g, "/").replace(/^\/+/, ""));
  if (normalized === ".." || normalized.startsWith("../")) return null;
  return normalized;
}

function currentDirectoryRelative(context: VaultTargetContext): string {
  if (!context.currentFilePath) return "";
  const currentDir = getParentDir(context.currentFilePath);
  const relative = getRelativePath(currentDir, context.workspaceRoot);
  if (relative === currentDir || relative.startsWith("/")) return "";
  return normalizeVaultRelative(relative) ?? "";
}

function combineRelative(base: string, target: string): string | null {
  return normalizeVaultRelative(base ? `${base}/${target}` : target);
}

function candidateFromEntry(entry: VaultEntry): VaultTargetCandidate {
  return {
    path: entry.path,
    relativePath: entry.relativePath,
    kind: entry.kind,
    label: entry.title || entry.stem || entry.name,
  };
}

function noteRelativeWithoutExtension(entry: VaultEntry): string {
  const lower = entry.relativePath.toLowerCase();
  if (lower.endsWith(".md")) return entry.relativePath.slice(0, -3);
  if (lower.endsWith(".markdown")) return entry.relativePath.slice(0, -9);
  return entry.relativePath;
}

function noteRelativeCandidates(target: string): string[] {
  const normalized = normalizeVaultRelative(target);
  if (!normalized) return [];
  const extension = getFileExtension(normalized).toLowerCase();
  if (NOTE_EXTENSIONS.has(extension)) return [normalized];
  return [`${normalized}.md`, `${normalized}.markdown`];
}

function findExactByRelative(
  entries: VaultEntry[],
  relativeCandidates: string[],
  predicate: (entry: VaultEntry) => boolean,
): VaultEntry[] {
  for (const candidate of relativeCandidates) {
    const exact = entries.filter((entry) => predicate(entry) && entry.relativePath === candidate);
    if (exact.length > 0) return exact;
  }

  for (const candidate of relativeCandidates) {
    const lower = candidate.toLowerCase();
    const exact = entries.filter(
      (entry) => predicate(entry) && entry.relativePath.toLowerCase() === lower,
    );
    if (exact.length > 0) return exact;
  }

  return [];
}

function chooseNote(
  entries: VaultEntry[],
  fragment: string | null,
  displayText: string,
  reason: string,
): VaultTargetResolution | null {
  if (entries.length === 0) return null;
  if (entries.length > 1) {
    return {
      kind: "ambiguous",
      candidates: entries.map(candidateFromEntry),
      reason,
      displayText,
    };
  }
  const entry = entries[0];
  return {
    kind: "resolved-note",
    path: entry.path,
    relativePath: entry.relativePath,
    fragment,
    displayText,
    entry,
  };
}

function chooseAsset(
  entries: VaultEntry[],
  displayText: string,
  reason: string,
): VaultTargetResolution | null {
  if (entries.length === 0) return null;
  if (entries.length > 1) {
    return {
      kind: "ambiguous",
      candidates: entries.map(candidateFromEntry),
      reason,
      displayText,
    };
  }
  const entry = entries[0];
  const assetKind = entry.kind === "pdf" ? "pdf" : "image";
  return {
    kind: "resolved-asset",
    path: entry.path,
    relativePath: entry.relativePath,
    assetKind,
    displayText,
    entry,
  };
}

function noteEntries(context: VaultTargetContext): VaultEntry[] {
  return context.entries.entries.filter((entry) => entry.kind === "note");
}

function assetEntries(context: VaultTargetContext, expectedKind: VaultAssetKind): VaultEntry[] {
  return context.entries.entries.filter((entry) =>
    expectedKind === "pdf" ? entry.kind === "pdf" : entry.kind === "image",
  );
}

function exactNoteResolution(
  context: VaultTargetContext,
  target: string,
  fragment: string | null,
  displayText: string,
  reason: string,
): VaultTargetResolution | null {
  const candidates = noteRelativeCandidates(target);
  if (candidates.length === 0) return null;
  return chooseNote(
    findExactByRelative(noteEntries(context), candidates, (entry) => entry.kind === "note"),
    fragment,
    displayText,
    reason,
  );
}

function exactAssetResolution(
  context: VaultTargetContext,
  target: string,
  expectedKind: VaultAssetKind,
  displayText: string,
  reason: string,
): VaultTargetResolution | null {
  const normalized = normalizeVaultRelative(target);
  if (!normalized) return null;
  return chooseAsset(
    findExactByRelative(
      assetEntries(context, expectedKind),
      [normalized],
      (entry) => entry.kind === expectedKind,
    ),
    displayText,
    reason,
  );
}

function relativeSuffixMatches(
  entries: VaultEntry[],
  target: string,
  pathForEntry: (entry: VaultEntry) => string,
): VaultEntry[] {
  const normalized = normalizeVaultRelative(target);
  if (!normalized) return [];
  const exact = entries.filter((entry) => {
    const value = pathForEntry(entry);
    return value === normalized || value.endsWith(`/${normalized}`);
  });
  if (exact.length > 0) return exact;

  const lower = normalized.toLowerCase();
  return entries.filter((entry) => {
    const value = pathForEntry(entry).toLowerCase();
    return value === lower || value.endsWith(`/${lower}`);
  });
}

function uniqueStemMatches(entries: VaultEntry[], target: string): VaultEntry[] {
  const exact = entries.filter((entry) => entry.stem === target);
  if (exact.length > 0) return exact;
  const lower = target.toLowerCase();
  return entries.filter((entry) => entry.stem.toLowerCase() === lower);
}

function uniqueAliasMatches(entries: VaultEntry[], target: string): VaultEntry[] {
  const exact = entries.filter((entry) => entry.aliases?.some((alias) => alias === target));
  if (exact.length > 0) return exact;
  const lower = target.toLowerCase();
  return entries.filter((entry) => entry.aliases?.some((alias) => alias.toLowerCase() === lower));
}

function uniqueTitleMatches(entries: VaultEntry[], target: string): VaultEntry[] {
  const exact = entries.filter((entry) => entry.title === target);
  if (exact.length > 0) return exact;
  const lower = target.toLowerCase();
  return entries.filter((entry) => entry.title?.toLowerCase() === lower);
}

function humanizeTarget(input: string): string {
  return input
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function uniqueHumanizedStemMatches(entries: VaultEntry[], target: string): VaultEntry[] {
  const humanized = humanizeTarget(target);
  if (!humanized) return [];
  return entries.filter((entry) => humanizeTarget(entry.stem) === humanized);
}

function hasEscapingTraversal(target: string, context: VaultTargetContext): boolean {
  if (WINDOWS_ABSOLUTE_PATH.test(target)) return false;
  const rootRelative = normalizeVaultRelative(target);
  const currentRelative = combineRelative(currentDirectoryRelative(context), target);
  return target.includes("..") && !rootRelative && !currentRelative;
}

export function resolveBodyWikilinkTarget(
  raw: string,
  context: VaultTargetContext,
): VaultTargetResolution {
  const parsed = parseWikiLikeTarget(raw);
  const target = parsed.path;

  if (!target && parsed.fragment && context.currentFilePath) {
    return {
      kind: "same-file-fragment",
      path: normalizePath(context.currentFilePath),
      fragment: parsed.fragment,
      displayText: parsed.displayText,
    };
  }

  if (!target) {
    return { kind: "unresolved", reason: "empty-target", displayText: parsed.displayText };
  }

  if (hasEscapingTraversal(target, context)) {
    return { kind: "unsafe", reason: "target-outside-vault", displayText: parsed.displayText };
  }

  if (target.includes("/")) {
    const rootExact = exactNoteResolution(
      context,
      target,
      parsed.fragment,
      parsed.displayText,
      "duplicate-note-path",
    );
    if (rootExact) return rootExact;

    const currentRelative = combineRelative(currentDirectoryRelative(context), target);
    if (currentRelative) {
      const currentExact = exactNoteResolution(
        context,
        currentRelative,
        parsed.fragment,
        parsed.displayText,
        "duplicate-note-path",
      );
      if (currentExact) return currentExact;
    }

    const suffix = chooseNote(
      relativeSuffixMatches(noteEntries(context), target, noteRelativeWithoutExtension),
      parsed.fragment,
      parsed.displayText,
      "ambiguous-note-suffix",
    );
    if (suffix) return suffix;

    const basename = getFileStem(target);
    const basenameMatch = chooseNote(
      uniqueStemMatches(noteEntries(context), basename),
      parsed.fragment,
      parsed.displayText,
      "ambiguous-note",
    );
    if (basenameMatch) return basenameMatch;

    return { kind: "unresolved", reason: "missing-note", displayText: parsed.displayText };
  }

  const entries = noteEntries(context);
  for (const matches of [
    uniqueStemMatches(entries, target),
    uniqueAliasMatches(entries, target),
    uniqueTitleMatches(entries, target),
    uniqueHumanizedStemMatches(entries, target),
  ]) {
    const result = chooseNote(matches, parsed.fragment, parsed.displayText, "ambiguous-note");
    if (result) return result;
  }

  return { kind: "unresolved", reason: "missing-note", displayText: parsed.displayText };
}

export function resolveFrontmatterWikilinkTarget(
  raw: string,
  context: VaultTargetContext,
): VaultTargetResolution {
  return resolveBodyWikilinkTarget(raw, context);
}

export function resolveObsidianEmbedTarget(
  raw: string,
  context: VaultTargetContext,
): VaultTargetResolution {
  const { target, modifier } = splitModifier(raw.trim());
  const normalizedTarget = normalizeAssetLookupPath(unescapeWikiText(target));
  const displayText =
    modifier && Number.isNaN(Number(modifier)) ? modifier : getFileName(normalizedTarget) || normalizedTarget;
  const expectedKind = assetKindFromTarget(normalizedTarget);

  if (!normalizedTarget) {
    return { kind: "unresolved", reason: "empty-target", displayText };
  }

  if (!expectedKind) {
    return { kind: "unresolved", reason: "unsupported-embed-kind", displayText };
  }

  if (hasEscapingTraversal(normalizedTarget, context)) {
    return { kind: "unsafe", reason: "target-outside-vault", displayText };
  }

  if (normalizedTarget.includes("/")) {
    const rootExact = exactAssetResolution(
      context,
      normalizedTarget,
      expectedKind,
      displayText,
      "duplicate-asset-path",
    );
    if (rootExact) return rootExact;

    const currentRelative = combineRelative(currentDirectoryRelative(context), normalizedTarget);
    if (currentRelative) {
      const currentExact = exactAssetResolution(
        context,
        currentRelative,
        expectedKind,
        displayText,
        "duplicate-asset-path",
      );
      if (currentExact) return currentExact;
    }

    const suffix = chooseAsset(
      relativeSuffixMatches(assetEntries(context, expectedKind), normalizedTarget, (entry) => entry.relativePath),
      displayText,
      "ambiguous-asset-suffix",
    );
    if (suffix) return suffix;
  } else {
    const sibling = combineRelative(currentDirectoryRelative(context), normalizedTarget);
    if (sibling) {
      const siblingExact = exactAssetResolution(
        context,
        sibling,
        expectedKind,
        displayText,
        "duplicate-asset-path",
      );
      if (siblingExact) return siblingExact;
    }
  }

  const commonFolderResult = chooseAsset(
    findExactByRelative(
      assetEntries(context, expectedKind),
      ["attachments", "Attachments", "assets", "Assets"].map(
        (folder) => `${folder}/${getFileName(normalizedTarget)}`,
      ),
      (entry) => entry.kind === expectedKind,
    ),
    displayText,
    "duplicate-asset-path",
  );
  if (commonFolderResult) return commonFolderResult;

  const currentAssetsDir = currentDirectoryRelative(context);
  const currentStem = context.currentFilePath ? getFileStem(context.currentFilePath) : "";
  if (currentStem) {
    const result = exactAssetResolution(
      context,
      combineRelative(currentAssetsDir, `${currentStem}-assets/${getFileName(normalizedTarget)}`) ??
        `${currentStem}-assets/${getFileName(normalizedTarget)}`,
      expectedKind,
      displayText,
      "duplicate-asset-path",
    );
    if (result) return result;
  }

  const assets = assetEntries(context, expectedKind);
  const name = getFileName(normalizedTarget);
  const exactName = assets.filter((entry) => entry.name === name);
  const result = chooseAsset(
    exactName.length > 0 ? exactName : assets.filter((entry) => entry.name.toLowerCase() === name.toLowerCase()),
    displayText,
    "ambiguous-asset-name",
  );
  return result ?? { kind: "unresolved", reason: "missing-asset", displayText };
}

export function resolveMarkdownTarget(
  rawTarget: string,
  source: Extract<VaultTargetSource, "markdown-link" | "markdown-image">,
  context: VaultTargetContext,
): VaultTargetResolution | null {
  const trimmed = rawTarget.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#") && context.currentFilePath) {
    return {
      kind: "same-file-fragment",
      path: normalizePath(context.currentFilePath),
      fragment: trimmed.slice(1),
      displayText: trimmed,
    };
  }
  if (EXPLICIT_URL_SCHEME.test(trimmed) && !WINDOWS_ABSOLUTE_PATH.test(trimmed)) {
    return { kind: "external-url", url: trimmed, displayText: trimmed };
  }

  const target = decodeLinkPath(stripLinkSuffix(trimmed)).replace(/\\/g, "/");
  const { fragment } = splitFragment(trimmed);
  const displayText = getFileName(target) || target;
  if (!target) return null;

  if (hasEscapingTraversal(target, context)) {
    return { kind: "unsafe", reason: "target-outside-vault", displayText };
  }

  const expectedAssetKind = assetKindFromTarget(target);
  const currentRelative = combineRelative(currentDirectoryRelative(context), target);
  if (currentRelative) {
    const note = exactNoteResolution(
      context,
      currentRelative,
      fragment,
      displayText,
      "duplicate-note-path",
    );
    if (note) return note;

    if (expectedAssetKind) {
      const asset = exactAssetResolution(
        context,
        currentRelative,
        expectedAssetKind,
        displayText,
        "duplicate-asset-path",
      );
      if (asset) return asset;
    }
  }

  if (target.startsWith("/")) {
    const rootRelative = normalizeVaultRelative(target);
    if (rootRelative) {
      const note = exactNoteResolution(
        context,
        rootRelative,
        fragment,
        displayText,
        "duplicate-note-path",
      );
      if (note) return note;

      if (expectedAssetKind) {
        const asset = exactAssetResolution(
          context,
          rootRelative,
          expectedAssetKind,
          displayText,
          "duplicate-asset-path",
        );
        if (asset) return asset;
      }
    }
  }

  if (expectedAssetKind) {
    const suffix = chooseAsset(
      relativeSuffixMatches(assetEntries(context, expectedAssetKind), target, (entry) => entry.relativePath),
      displayText,
      "ambiguous-asset-suffix",
    );
    if (suffix) return suffix;
  }

  if (source === "markdown-image" || expectedAssetKind) {
    return { kind: "unresolved", reason: "missing-asset", displayText };
  }

  return { kind: "external-path", path: target, displayText };
}
