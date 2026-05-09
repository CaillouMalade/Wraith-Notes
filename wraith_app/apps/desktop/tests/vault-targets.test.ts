import { describe, expect, test } from "vite-plus/test";
import {
  createVaultEntryIndex,
  resolveBodyWikilinkTarget,
  resolveMarkdownTarget,
  resolveObsidianEmbedTarget,
  vaultEntryFromPath,
  type VaultEntry,
  type VaultTargetContext,
} from "../src/lib/vault-targets";

const ROOT = "/vault";

function entry(path: string, extra: Partial<VaultEntry> = {}): VaultEntry {
  return {
    ...vaultEntryFromPath(path, ROOT),
    ...extra,
  };
}

function context(entries: VaultEntry[], currentFilePath = "/vault/Notes With Spaces/Uses Media.md"): VaultTargetContext {
  return {
    workspaceRoot: ROOT,
    currentFilePath,
    entries: createVaultEntryIndex(entries),
  };
}

const FIXTURE_ENTRIES = [
  entry("/vault/Inbox.md"),
  entry("/vault/Projects/Project One.md", {
    title: "Project Alpha",
    aliases: ["Alpha Project"],
  }),
  entry("/vault/Projects/Project Two.markdown"),
  entry("/vault/Projects/Duplicate.md"),
  entry("/vault/Archive/Duplicate.md"),
  entry("/vault/People/A B.md", { aliases: ["Arthur"] }),
  entry("/vault/Notes With Spaces/Uses Media.md"),
  entry("/vault/Assets/diagram.png"),
  entry("/vault/Assets/Diagram.png"),
  entry("/vault/Images/dupe.png"),
  entry("/vault/Archive/dupe.png"),
  entry("/vault/Assets/manual.pdf"),
  entry("/vault/attachments/Pasted image 2026-01-01 123000.png"),
  entry("/vault/Notes With Spaces/local.png"),
];

describe("resolveBodyWikilinkTarget", () => {
  test("resolves bare note stems", () => {
    expect(resolveBodyWikilinkTarget("Inbox", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "resolved-note",
      path: "/vault/Inbox.md",
      fragment: null,
      displayText: "Inbox",
    });
  });

  test("reports duplicate note stems as ambiguous", () => {
    const result = resolveBodyWikilinkTarget("Duplicate", context(FIXTURE_ENTRIES));
    expect(result).toMatchObject({ kind: "ambiguous", reason: "ambiguous-note" });
    expect(result.kind === "ambiguous" ? result.candidates.map((candidate) => candidate.relativePath) : []).toEqual([
      "Projects/Duplicate.md",
      "Archive/Duplicate.md",
    ]);
  });

  test("resolves folder-qualified note paths and markdown suffixes", () => {
    expect(resolveBodyWikilinkTarget("Projects/Project One.md", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "resolved-note",
      path: "/vault/Projects/Project One.md",
    });
    expect(resolveBodyWikilinkTarget("Projects/Project Two.markdown", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "resolved-note",
      path: "/vault/Projects/Project Two.markdown",
    });
  });

  test("resolves aliases, titles, and fragments without dropping display text", () => {
    expect(resolveBodyWikilinkTarget("Alpha Project#Next|Roadmap", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "resolved-note",
      path: "/vault/Projects/Project One.md",
      fragment: "Next",
      displayText: "Roadmap",
    });
    expect(resolveBodyWikilinkTarget("Project Alpha", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "resolved-note",
      path: "/vault/Projects/Project One.md",
    });
  });

  test("resolves same-file fragments against the current file", () => {
    expect(resolveBodyWikilinkTarget("#Heading|Here", context(FIXTURE_ENTRIES))).toEqual({
      kind: "same-file-fragment",
      path: "/vault/Notes With Spaces/Uses Media.md",
      fragment: "Heading",
      displayText: "Here",
    });
  });

  test("resolves unique old path suffixes", () => {
    expect(resolveBodyWikilinkTarget("old/vault/People/A B", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "resolved-note",
      path: "/vault/People/A B.md",
    });
  });
});

describe("resolveObsidianEmbedTarget", () => {
  test("resolves current-file sibling images before global filename search", () => {
    expect(resolveObsidianEmbedTarget("local.png", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "resolved-asset",
      path: "/vault/Notes With Spaces/local.png",
      assetKind: "image",
    });
  });

  test("resolves attachment-folder images", () => {
    expect(
      resolveObsidianEmbedTarget("Pasted image 2026-01-01 123000.png|cover", context(FIXTURE_ENTRIES)),
    ).toMatchObject({
      kind: "resolved-asset",
      path: "/vault/attachments/Pasted image 2026-01-01 123000.png",
      assetKind: "image",
      displayText: "cover",
    });
  });

  test("reports duplicate image basenames as ambiguous", () => {
    const result = resolveObsidianEmbedTarget("dupe.png", context(FIXTURE_ENTRIES));
    expect(result).toMatchObject({ kind: "ambiguous", reason: "ambiguous-asset-name" });
    expect(result.kind === "ambiguous" ? result.candidates.map((candidate) => candidate.relativePath) : []).toEqual([
      "Images/dupe.png",
      "Archive/dupe.png",
    ]);
  });

  test("resolves PDF embeds as assets", () => {
    expect(resolveObsidianEmbedTarget("Assets/manual.pdf", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "resolved-asset",
      path: "/vault/Assets/manual.pdf",
      assetKind: "pdf",
    });
  });

  test("returns explicit states for unsupported, missing, and unsafe embeds", () => {
    expect(resolveObsidianEmbedTarget("Projects/Project One", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "unresolved",
      reason: "unsupported-embed-kind",
    });
    expect(resolveObsidianEmbedTarget("missing.png", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "unresolved",
      reason: "missing-asset",
    });
    expect(resolveObsidianEmbedTarget("../../outside.png", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "unsafe",
      reason: "target-outside-vault",
    });
  });
});

describe("resolveMarkdownTarget", () => {
  test("resolves current-relative Markdown links and local assets", () => {
    expect(resolveMarkdownTarget("../Inbox.md#Top", "markdown-link", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "resolved-note",
      path: "/vault/Inbox.md",
      fragment: "Top",
    });
    expect(resolveMarkdownTarget("./local.png", "markdown-image", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "resolved-asset",
      path: "/vault/Notes With Spaces/local.png",
      assetKind: "image",
    });
  });

  test("resolves vault-root PDF links", () => {
    expect(resolveMarkdownTarget("/Assets/manual.pdf", "markdown-link", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "resolved-asset",
      path: "/vault/Assets/manual.pdf",
      assetKind: "pdf",
    });
  });

  test("keeps external URLs external and unsafe traversal distinct", () => {
    expect(resolveMarkdownTarget("https://example.com", "markdown-link", context(FIXTURE_ENTRIES))).toEqual({
      kind: "external-url",
      url: "https://example.com",
      displayText: "https://example.com",
    });
    expect(resolveMarkdownTarget("../../outside.md", "markdown-link", context(FIXTURE_ENTRIES))).toMatchObject({
      kind: "unsafe",
      reason: "target-outside-vault",
    });
  });
});
