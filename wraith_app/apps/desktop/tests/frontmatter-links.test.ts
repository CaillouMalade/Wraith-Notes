import { describe, expect, test } from "vite-plus/test";
import { hasFrontmatterLinks, parseFrontmatterLinks } from "../src/lib/frontmatter-links";

describe("frontmatter links", () => {
  test("detects wikilinks inside scalar text", () => {
    expect(hasFrontmatterLinks("Discuss with [[People/Arthur|Arthur]] before shipping")).toBe(true);
    expect(hasFrontmatterLinks("plain text")).toBe(false);
  });

  test("splits mixed text and wikilink chips", () => {
    expect(parseFrontmatterLinks("A [[Project One|One]] and [[Project Two]]")).toEqual([
      { kind: "text", text: "A " },
      { kind: "wikilink", raw: "Project One|One", label: "One" },
      { kind: "text", text: " and " },
      { kind: "wikilink", raw: "Project Two", label: "Project Two" },
    ]);
  });
});
