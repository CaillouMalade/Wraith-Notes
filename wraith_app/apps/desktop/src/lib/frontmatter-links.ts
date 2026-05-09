export interface FrontmatterTextPart {
  kind: "text";
  text: string;
}

export interface FrontmatterWikiPart {
  kind: "wikilink";
  raw: string;
  label: string;
}

export type FrontmatterLinkPart = FrontmatterTextPart | FrontmatterWikiPart;

const WIKI_RE = /\[\[([^\]]+)\]\]/g;

function labelFor(raw: string) {
  const pipe = raw.indexOf("|");
  const target = pipe === -1 ? raw : raw.slice(0, pipe);
  const alias = pipe === -1 ? null : raw.slice(pipe + 1);
  return (alias || target.split("#")[0] || raw).trim();
}

export function parseFrontmatterLinks(value: string): FrontmatterLinkPart[] {
  const parts: FrontmatterLinkPart[] = [];
  WIKI_RE.lastIndex = 0;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKI_RE.exec(value))) {
    if (match.index > last) {
      parts.push({ kind: "text", text: value.slice(last, match.index) });
    }
    parts.push({ kind: "wikilink", raw: match[1], label: labelFor(match[1]) });
    last = match.index + match[0].length;
  }
  if (last < value.length) parts.push({ kind: "text", text: value.slice(last) });
  return parts;
}

export function hasFrontmatterLinks(value: string) {
  return /\[\[[^\]]+\]\]/.test(value);
}
