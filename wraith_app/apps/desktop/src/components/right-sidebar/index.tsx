import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiChat01Icon,
  ArrowDown01Icon,
  ArrowReloadHorizontalIcon,
  ArrowUp01Icon,
  ComputerTerminal01Icon,
  AlertCircleIcon,
  CodeIcon,
  FileDiffIcon,
  FileViewIcon,
  FolderOpenIcon,
  GitBranchIcon,
  LeftToRightListBulletIcon,
  Link01Icon,
  PanelRightCloseIcon,
  PlayIcon,
  StopIcon,
} from "@hugeicons/core-free-icons";
import { useUIStore, type RightSidebarView } from "@/stores/ui-store";
import { useActiveFilePath, useFileContent, useFileFrontmatter } from "@/hooks/use-tabs";
import * as editorApi from "@/hooks/editor-api";
import { getWorkspaceRoot } from "@/hooks/workspace-api";
import { useSetting } from "@/hooks/use-settings";
import {
  AGENT_PROFILES_SETTING_KEY,
  parseAgentProfiles,
  type AgentProfile,
} from "@/lib/agent-profiles";
import { hasFrontmatterLinks, parseFrontmatterLinks } from "@/lib/frontmatter-links";
import { parseYamlEntries } from "@/lib/yaml-entries";
import { jumpToEditorLine } from "@/lib/editor-navigation";
import { resolveWikiLink } from "@/lib/wiki-links";
import { GIT_REFRESH_EVENT, requestGitRefresh } from "@/lib/git-refresh";
import { DEFAULT_GIT_COMMIT_MESSAGE } from "@/lib/git-actions";
import * as tauri from "@/lib/tauri";

const VIEWS: Array<{ id: RightSidebarView; label: string; icon: typeof AiChat01Icon }> = [
  { id: "agent", label: "Agent", icon: AiChat01Icon },
  { id: "terminal", label: "Terminal", icon: ComputerTerminal01Icon },
  { id: "git", label: "Git", icon: GitBranchIcon },
  { id: "properties", label: "Properties", icon: CodeIcon },
  { id: "outline", label: "Outline", icon: LeftToRightListBulletIcon },
];

type AgentMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agentLabel?: string;
};

const AGENT_PROFILE_STORAGE_KEY = "wraith.agent.profile";
const DEFAULT_TERMINAL_FONT_FAMILY =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
function normalizeTerminalFontFamily(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_TERMINAL_FONT_FAMILY;
}

function terminalTheme() {
  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue("--accent").trim() || "#ff6a00";
  const muted = style.getPropertyValue("--text-muted").trim() || "#8a8a8a";
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  return {
    background: "#00000000",
    foreground: isLight ? "#111111" : "#F7F3EA",
    cursor: accent,
    selectionBackground: resolveCssColor(
      `color-mix(in srgb, ${accent} 30%, transparent)`,
      "rgba(255, 106, 0, 0.3)",
    ),
    selectionInactiveBackground: resolveCssColor(
      "color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 20%), transparent)",
      "rgba(128, 128, 128, 0.18)",
    ),
    brightBlack: muted,
    brightBlue: accent,
    brightCyan: accent,
    brightGreen: "#34c759",
    brightRed: "#ff453a",
    brightYellow: "#ff9f0a",
    scrollbarSliderBackground:
      "color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 42%), transparent)",
    scrollbarSliderHoverBackground:
      "color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 58%), transparent)",
    scrollbarSliderActiveBackground:
      "color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 72%), transparent)",
  };
}

function parseCommandLine(input: string): string[] {
  const result: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;

  for (const char of input.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        result.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (current) result.push(current);
  return result;
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildAgentPrompt(messages: AgentMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}:\n${message.content}`)
    .join("\n\n");
}

function initialAgentProfileId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AGENT_PROFILE_STORAGE_KEY);
}

function commandFromProfile(profile: AgentProfile | null) {
  if (!profile) return { label: "Agent", program: "", args: [] as string[], command: "" };
  const parts = parseCommandLine(profile.command);
  return {
    label: profile.name,
    program: parts[0] ?? "",
    args: parts.slice(1),
    command: profile.command,
  };
}

function OutputBlock({ output }: { output: tauri.CommandOutput | null }) {
  if (!output) return null;
  const text = [output.stdout, output.stderr].filter(Boolean).join("\n").trim();
  return (
    <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--line-subtler)] bg-[var(--surface-subtle)] p-3 font-mono text-[12px] leading-relaxed text-[var(--text-secondary)]">
      {text || `Exited with status ${output.status}`}
    </pre>
  );
}

function commandText(output: tauri.CommandOutput | null) {
  if (!output) return "";
  return [output.stdout, output.stderr].filter(Boolean).join("\n").trim();
}

function PanelIconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--line-subtler)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] transition-[background-color,border-color,color,opacity] duration-[var(--motion-quick-duration)] ease-[var(--motion-soft-ease)] hover:bg-[var(--surface-selected)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

type GitFileStatus = {
  code: string;
  path: string;
};

type FileChangePayload = {
  path: string;
  kind: "modified" | "created" | "deleted" | "renamed";
};

type ParsedGitStatus = {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
};

type ParsedGitRemote = {
  name: string;
  url: string;
  directions: string[];
};

function parseGitStatus(output: tauri.CommandOutput | null): ParsedGitStatus | null {
  if (!output || output.status !== 0) return null;

  const lines = output.stdout.split(/\r?\n/).filter(Boolean);
  const branchLine = lines[0]?.startsWith("## ") ? lines[0].slice(3) : "";
  const statusMatch = branchLine.match(/\s+\[(.+)\]$/);
  const statusText = statusMatch?.[1] ?? "";
  const branchAndUpstream = statusMatch ? branchLine.slice(0, statusMatch.index).trim() : branchLine;
  const [branchPart, upstreamPart] = branchAndUpstream.split("...");
  const ahead = Number(statusText.match(/ahead (\d+)/)?.[1] ?? 0);
  const behind = Number(statusText.match(/behind (\d+)/)?.[1] ?? 0);

  return {
    branch: branchPart || branchLine || "Unknown",
    upstream: upstreamPart || null,
    ahead,
    behind,
    files: lines
      .slice(branchLine ? 1 : 0)
      .map((line) => ({
        code: line.slice(0, 2).trim() || "?",
        path: line.slice(3).trim(),
      }))
      .filter((file) => file.path.length > 0),
  };
}

function parseGitRemotes(output: tauri.CommandOutput | null): ParsedGitRemote[] {
  if (!output || output.status !== 0) return [];

  const remotes = new Map<string, ParsedGitRemote>();
  for (const line of output.stdout.split(/\r?\n/)) {
    const match = line.match(/^(\S+)\s+(\S+)(?:\s+\(([^)]+)\))?/);
    if (!match) continue;
    const [, name, url, direction] = match;
    const current = remotes.get(name) ?? { name, url, directions: [] };
    if (direction && !current.directions.includes(direction)) {
      current.directions.push(direction);
    }
    remotes.set(name, current);
  }

  return [...remotes.values()];
}

function isNotGitRepository(output: tauri.CommandOutput | null) {
  if (!output || output.status === 0) return false;
  const text = commandText(output).toLowerCase();
  return text.includes("not a git repository") || text.includes("not a git repo");
}

function isConflictStatus(code: string) {
  return code.includes("U") || ["AA", "DD"].includes(code);
}

function gitStatusLabel(code: string) {
  if (isConflictStatus(code)) return "Conflict";
  if (code.includes("?")) return "New";
  if (code.includes("D")) return "Deleted";
  if (code.includes("R")) return "Renamed";
  if (code.includes("A")) return "Added";
  if (code.includes("M")) return "Modified";
  return code || "Changed";
}

function normalizeGitStatusPath(path: string) {
  const arrow = path.lastIndexOf(" -> ");
  return arrow === -1 ? path : path.slice(arrow + 4);
}

function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatCheckedAt(timestamp: number | null) {
  if (!timestamp) return "not checked yet";
  return `checked ${new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}

function gitSyncSummary(
  status: ParsedGitStatus | null,
  statusOutput: tauri.CommandOutput | null,
): { label: string; tone: "clean" | "pending" | "conflict" | "error" | "loading" } {
  if (!statusOutput) return { label: "Loading status...", tone: "loading" };
  if (statusOutput.status !== 0) return { label: commandText(statusOutput) || "Git status failed", tone: "error" };
  if (!status) return { label: "Loading status...", tone: "loading" };

  const conflicts = status.files.filter((file) => isConflictStatus(file.code)).length;
  if (conflicts > 0) return { label: pluralize(conflicts, "conflict"), tone: "conflict" };

  if (status.ahead > 0 && status.behind > 0) {
    return { label: `Diverged: ${status.ahead} ahead, ${status.behind} behind`, tone: "pending" };
  }
  if (status.ahead > 0) return { label: pluralize(status.ahead, "commit to push"), tone: "pending" };
  if (status.behind > 0) return { label: pluralize(status.behind, "commit to pull"), tone: "pending" };

  return { label: status.upstream ? "Remote up to date" : "No upstream configured", tone: "clean" };
}

function gitChangeListTitle(status: ParsedGitStatus | null) {
  const files = status?.files ?? [];
  if (files.length === 0) return "No pending changes";
  return pluralize(files.length, "pending change");
}

function gitStateDotStyle(tone: ReturnType<typeof gitSyncSummary>["tone"]) {
  if (tone === "clean") return { background: "#34c759" };
  if (tone === "pending") return { background: "#ff9f0a" };
  if (tone === "conflict" || tone === "error") return { background: "#ff453a" };
  return { background: "var(--text-muted)" };
}

function extensionFromPath(path: string) {
  const clean = path.split(/[?#]/)[0] ?? path;
  const name = clean.split(/[\\/]/).pop() ?? clean;
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function resolveCssColor(value: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const probe = document.createElement("span");
  probe.style.color = fallback;
  probe.style.color = trimmed;
  probe.style.position = "absolute";
  probe.style.pointerEvents = "none";
  probe.style.opacity = "0";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || fallback;
}

function isMarkdownPath(path: string) {
  return ["md", "mdx", "markdown"].includes(extensionFromPath(path));
}

function assetKindFromPath(path: string): "image" | "pdf" | null {
  const extension = extensionFromPath(path);
  if (extension === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tiff"].includes(extension)) {
    return "image";
  }
  return null;
}

function workspacePath(relativePath: string) {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return null;
  return `${workspaceRoot.replace(/\/$/, "")}/${relativePath.replace(/^\/+/, "")}`;
}

function AgentPanel() {
  const rawProfiles = useSetting(AGENT_PROFILES_SETTING_KEY);
  const profiles = useMemo(() => parseAgentProfiles(rawProfiles), [rawProfiles]);
  const enabledProfiles = useMemo(
    () => profiles.filter((profile) => profile.enabled && profile.command.trim()),
    [profiles],
  );
  const [draft, setDraft] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() =>
    initialAgentProfileId(),
  );
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const runningAgentIdRef = useRef<string | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const runningCommandLabelRef = useRef("Agent");

  const selectedProfile = useMemo(
    () =>
      enabledProfiles.find((profile) => profile.id === selectedProfileId) ??
      enabledProfiles[0] ??
      null,
    [enabledProfiles, selectedProfileId],
  );

  const selectedCommand = useMemo(() => commandFromProfile(selectedProfile), [selectedProfile]);

  useEffect(() => {
    if (!selectedProfile || selectedProfile.id === selectedProfileId) return;
    setSelectedProfileId(selectedProfile.id);
  }, [selectedProfile, selectedProfileId]);

  useEffect(() => {
    if (selectedProfileId) {
      window.localStorage.setItem(AGENT_PROFILE_STORAGE_KEY, selectedProfileId);
    } else {
      window.localStorage.removeItem(AGENT_PROFILE_STORAGE_KEY);
    }
  }, [selectedProfileId]);

  const stop = useCallback(async () => {
    const id = runningAgentIdRef.current;
    runningAgentIdRef.current = null;
    streamingMessageIdRef.current = null;
    setIsRunning(false);
    if (id) {
      await tauri.agentStop(id).catch(() => {});
    }
  }, []);

  useEffect(() => {
    let isDisposed = false;
    let unlisten: (() => void) | null = null;

    void listen<tauri.AgentDataEvent>("agent:data", (event) => {
      if (isDisposed || event.payload.id !== runningAgentIdRef.current) return;

      if (event.payload.stream === "exit") {
        const status = event.payload.status ?? 0;
        const messageId = streamingMessageIdRef.current;
        if (status !== 0) {
          const text = `${runningCommandLabelRef.current} exited with status ${status}`;
          if (messageId) {
            setMessages((current) =>
              current.map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      role: message.content.trim().length === 0 ? "system" : message.role,
                      content:
                        message.content.trim().length === 0
                          ? text
                          : `${message.content}\n\n${text}`,
                    }
                  : message,
              ),
            );
          }
        }
        runningAgentIdRef.current = null;
        streamingMessageIdRef.current = null;
        setIsRunning(false);
        return;
      }

      const messageId = streamingMessageIdRef.current;
      if (!messageId || !event.payload.data) return;
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                role:
                  event.payload.stream === "stderr" && !message.content
                    ? "system"
                    : message.role,
                content: `${message.content}${event.payload.data}`,
              }
            : message,
        ),
      );
    }).then((dispose) => {
      if (isDisposed) {
        dispose();
      } else {
        unlisten = dispose;
      }
    });

    return () => {
      isDisposed = true;
      unlisten?.();
      void stop();
    };
  }, [stop]);

  async function send() {
    const trimmed = draft.trim();
    if (!trimmed || isRunning || !selectedCommand.program) return;
    const userMessage: AgentMessage = { id: newId(), role: "user", content: trimmed };
    const assistantMessage: AgentMessage = {
      id: newId(),
      role: "assistant",
      content: "",
      agentLabel: selectedCommand.label,
    };
    const nextMessages = [...messages, userMessage];
    const agentId = newId();

    setDraft("");
    setMessages([...nextMessages, assistantMessage]);
    setIsRunning(true);
    runningCommandLabelRef.current = selectedCommand.command || selectedCommand.program;
    runningAgentIdRef.current = agentId;
    streamingMessageIdRef.current = assistantMessage.id;
    try {
      await tauri.agentStart(
        agentId,
        selectedCommand.program,
        selectedCommand.args,
        buildAgentPrompt(nextMessages),
        selectedProfile?.workingDirectory || null,
      );
    } catch (error) {
      runningAgentIdRef.current = null;
      streamingMessageIdRef.current = null;
      setMessages((current) => [
        ...current.filter((message) => message.id !== assistantMessage.id),
        {
          id: newId(),
          role: "system",
          content: `${selectedCommand.command || selectedCommand.program} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ]);
      setIsRunning(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap gap-1 rounded-md border border-[var(--line-subtler)] bg-[var(--surface-subtle)] p-1">
        {enabledProfiles.length === 0 ? (
          <button
            type="button"
            onClick={() => editorApi.openSettingsTab()}
            className="h-7 w-full rounded-[5px] text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface-selected)] hover:text-[var(--text-secondary)]"
          >
            Configure agents
          </button>
        ) : (
          enabledProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => setSelectedProfileId(profile.id)}
              className={`h-7 min-w-0 flex-1 rounded-[5px] px-2 text-[13px] transition-[background-color,color] duration-[var(--motion-quick-duration)] ease-[var(--motion-soft-ease)] ${
                selectedProfile?.id === profile.id
                  ? "bg-[var(--surface-selected)] text-[var(--text-secondary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <span className="block truncate">{profile.name}</span>
            </button>
          ))
        )}
      </div>
      {selectedProfile && (
        <div className="min-w-0 rounded-md border border-[var(--line-subtler)] bg-[var(--surface-subtle)] px-3 py-2">
          <div className="truncate font-mono text-[12px] text-[var(--text-secondary)]">
            {selectedProfile.command}
          </div>
          <div className="mt-1 truncate text-[12px] text-[var(--text-muted)]">
            {selectedProfile.workingDirectory.trim() || "vault root"}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--line-subtler)] bg-[var(--surface-subtle)] p-2">
        {messages.length === 0 ? (
          <div className="px-1 py-1 text-[13px] text-[var(--text-muted)]">
            {selectedProfile
              ? `Ask ${selectedProfile.name} about this vault.`
              : "Configure an enabled agent in Preferences."}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((message) => (
              <div
                key={message.id}
                style={
                  message.role === "user"
                    ? {
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                        borderColor:
                          "color-mix(in srgb, var(--accent) 45%, transparent)",
                      }
                    : undefined
                }
                className={`rounded-md px-3 py-2 text-[13px] leading-relaxed ${
                  message.role === "user"
                    ? "border text-[var(--text-primary)]"
                    : message.role === "assistant"
                      ? "bg-[var(--surface-input)] text-[var(--text-secondary)]"
                      : "border border-[var(--line-subtle)] text-[var(--text-muted)]"
                }`}
              >
                <div
                  className={`mb-1 text-[11px] uppercase ${
                    message.role === "user"
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  {message.role === "user"
                    ? "You"
                    : message.role === "assistant"
                      ? (message.agentLabel ?? selectedCommand.label)
                      : "System"}
                </div>
                <div className="whitespace-pre-wrap">
                  {message.content || (isRunning ? "Waiting..." : "")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void send();
          }
        }}
        placeholder="Ask the workspace agent..."
        className="min-h-24 resize-none rounded-md border border-[var(--line-subtler)] bg-[var(--surface-input)] p-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--focus-border)]"
      />
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <button
          type="button"
          onClick={() => void send()}
          className="right-sidebar-button right-sidebar-button-primary"
          disabled={!draft.trim() || !selectedCommand.program || isRunning}
        >
          {isRunning ? "Running..." : `Send to ${selectedCommand.label}`}
        </button>
        <button
          type="button"
          onClick={() => void stop()}
          className="right-sidebar-button"
          disabled={!isRunning}
        >
          Stop
        </button>
        <button
          type="button"
          onClick={() => setMessages([])}
          className="right-sidebar-button"
          disabled={messages.length === 0 || isRunning}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function TerminalPanel() {
  const [session, setSession] = useState<tauri.TerminalStartResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const terminalFontFamily = normalizeTerminalFontFamily(useSetting("terminal.font-family"));
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isStartingRef = useRef(false);
  const terminalFontFamilyRef = useRef(terminalFontFamily);

  const resizeTerminal = useCallback(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon || !containerRef.current) return;
    if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) return;

    try {
      fitAddon.fit();
      const id = sessionIdRef.current;
      if (id) {
        void tauri.terminalResize(id, terminal.cols, terminal.rows).catch(() => {});
      }
    } catch {
      // xterm can throw while the panel is measuring during mount/unmount.
    }
  }, []);

  const stopTerminal = useCallback(async () => {
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    setSession(null);
    if (id) {
      await tauri.terminalStop(id).catch(() => {});
    }
  }, []);

  const startTerminal = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setIsStarting(true);
    setError(null);
    await stopTerminal();
    try {
      resizeTerminal();
      const terminal = terminalRef.current;
      const started = await tauri.terminalStart(terminal?.cols ?? 80, terminal?.rows ?? 24);
      sessionIdRef.current = started.id;
      setSession(started);
      terminal?.focus();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  }, [resizeTerminal, stopTerminal]);

  useEffect(() => {
    terminalFontFamilyRef.current = terminalFontFamily;
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options = {
      fontFamily: terminalFontFamily,
      theme: terminalTheme(),
    };
    requestAnimationFrame(resizeTerminal);
  }, [resizeTerminal, terminalFontFamily]);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      const terminal = terminalRef.current;
      if (terminal) terminal.options = { theme: terminalTheme() };
    };
    const observer = new MutationObserver(applyTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "style"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let isDisposed = false;
    let unlisten: (() => void) | null = null;

    const terminal = new XTerm({
      allowTransparency: true,
      cursorBlink: true,
      convertEol: false,
      fontFamily: terminalFontFamilyRef.current,
      fontSize: 12,
      lineHeight: 1.25,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      scrollback: 5000,
      theme: terminalTheme(),
    });
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(container);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const dataDisposable = terminal.onData((data) => {
      const id = sessionIdRef.current;
      if (!id) return;
      void tauri.terminalWrite(id, data).catch((error: unknown) => {
        setError(error instanceof Error ? error.message : String(error));
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(resizeTerminal);
    });
    resizeObserver.observe(container);

    void listen<tauri.TerminalDataEvent>("terminal:data", (event) => {
      if (isDisposed) return;
      if (event.payload.id !== sessionIdRef.current) return;
      terminalRef.current?.write(event.payload.data);
      if (event.payload.stream === "exit") {
        sessionIdRef.current = null;
        setSession(null);
      }
    })
      .then((dispose) => {
        if (isDisposed) {
          dispose();
          return;
        }
        unlisten = dispose;
        requestAnimationFrame(() => {
          if (isDisposed) return;
          resizeTerminal();
          void startTerminal();
        });
      })
      .catch((error: unknown) => {
        if (!isDisposed) setError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      isDisposed = true;
      unlisten?.();
      resizeObserver.disconnect();
      dataDisposable.dispose();
      void stopTerminal();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [resizeTerminal, startTerminal, stopTerminal]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-muted)]">
          {session ? session.cwd : error ?? "Starting shell..."}
        </div>
        <PanelIconButton label="Restart terminal" onClick={() => void startTerminal()} disabled={isStarting}>
          <HugeiconsIcon icon={PlayIcon} size={15} color="currentColor" strokeWidth={2} />
        </PanelIconButton>
        <PanelIconButton label="Stop terminal" onClick={() => void stopTerminal()} disabled={!session}>
          <HugeiconsIcon icon={StopIcon} size={15} color="currentColor" strokeWidth={2} />
        </PanelIconButton>
      </div>
      <div
        ref={containerRef}
        className="wraith-terminal-surface min-h-0 flex-1 overflow-hidden rounded-md border border-[var(--line-subtler)] p-2"
      />
    </div>
  );
}

function GitPanel({ isActive }: { isActive: boolean }) {
  const [message, setMessage] = useState("");
  const [remoteName, setRemoteName] = useState("origin");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<GitFileStatus | null>(null);
  const [output, setOutput] = useState<tauri.CommandOutput | null>(null);
  const [statusOutput, setStatusOutput] = useState<tauri.CommandOutput | null>(null);
  const [remoteOutput, setRemoteOutput] = useState<tauri.CommandOutput | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastStatusAt, setLastStatusAt] = useState<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const status = useMemo(() => parseGitStatus(statusOutput), [statusOutput]);
  const remotes = useMemo(() => parseGitRemotes(remoteOutput), [remoteOutput]);
  const conflicts = useMemo(
    () => status?.files.filter((file) => isConflictStatus(file.code)) ?? [],
    [status],
  );
  const hasConflicts = conflicts.length > 0;
  const isGitRepository = statusOutput?.status === 0;
  const isMissingGitRepository = isNotGitRepository(statusOutput);
  const summary = useMemo(() => gitSyncSummary(status, statusOutput), [status, statusOutput]);

  useEffect(() => {
    if (!selectedFile) return;
    const stillPresent = status?.files.some(
      (file) => file.code === selectedFile.code && file.path === selectedFile.path,
    );
    if (!stillPresent) setSelectedFile(null);
  }, [selectedFile, status]);

  const refreshStatus = useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return null;
    }
    refreshInFlightRef.current = true;
    try {
      const next = await tauri.gitStatus();
      setStatusOutput(next);
      setLastStatusAt(Date.now());
      setOutput((current) => current ?? next);
      if (next.status === 0) {
        try {
          setRemoteOutput(await tauri.gitRemotes());
        } catch (error) {
          setRemoteOutput({
            status: 1,
            stdout: "",
            stderr: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        setRemoteOutput(null);
      }
      return next;
    } catch (error) {
      const next = { status: 1, stdout: "", stderr: error instanceof Error ? error.message : String(error) };
      setStatusOutput(next);
      setLastStatusAt(Date.now());
      setOutput((current) => current ?? next);
      setRemoteOutput(null);
      return next;
    } finally {
      refreshInFlightRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        window.setTimeout(() => {
          void refreshStatus();
        }, 50);
      }
    }
  }, []);

  const scheduleStatusRefresh = useCallback(
    (delayMs = 180) => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void refreshStatus();
      }, delayMs);
    },
    [refreshStatus],
  );

  useEffect(() => {
    void refreshStatus();
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, isActive ? 2_000 : 10_000);

    const handleRefreshRequest = () => scheduleStatusRefresh(80);
    const handleWindowFocus = () => scheduleStatusRefresh(80);
    const handleVisibility = () => {
      if (!document.hidden) scheduleStatusRefresh(80);
    };
    const disposeListener = (dispose: () => void) => {
      try {
        dispose();
      } catch {
        // Tauri may already have dropped the listener during dev/HMR teardown.
      }
    };

    const unlistenFile = listen<FileChangePayload>("fs:file-changed", () => scheduleStatusRefresh(160));
    const unlistenDir = listen<FileChangePayload>("fs:directory-changed", () => scheduleStatusRefresh(160));

    window.addEventListener(GIT_REFRESH_EVENT, handleRefreshRequest);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      window.removeEventListener(GIT_REFRESH_EVENT, handleRefreshRequest);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      void unlistenFile.then(disposeListener).catch(() => {});
      void unlistenDir.then(disposeListener).catch(() => {});
    };
  }, [isActive, refreshStatus, scheduleStatusRefresh]);

  async function run(
    action: () => Promise<tauri.CommandOutput>,
    options: { clearMessage?: boolean; clearRemote?: boolean } = {},
  ) {
    if (isRunning) return;
    setIsRunning(true);
    try {
      const result = await action();
      setOutput(result);
      if (options.clearMessage && result.status === 0) setMessage("");
      if (options.clearRemote && result.status === 0) setRemoteUrl("");
      requestGitRefresh("git-action");
      await refreshStatus();
      window.setTimeout(() => void refreshStatus(), 400);
    } catch (error) {
      setOutput({ status: 1, stdout: "", stderr: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRunning(false);
    }
  }

  function commitMessage() {
    return message.trim() || DEFAULT_GIT_COMMIT_MESSAGE;
  }

  async function checkRemote() {
    if (isRunning) return;
    setIsRunning(true);
    try {
      const fetch = await tauri.gitFetch();
      const nextStatus = await refreshStatus();
      setOutput({
        status: fetch.status,
        stdout: [`$ git fetch --prune`, commandText(fetch), nextStatus ? `$ git status --short --branch --untracked-files=all\n${nextStatus.stdout.trim()}` : ""]
          .filter(Boolean)
          .join("\n\n"),
        stderr: fetch.stderr,
      });
    } catch (error) {
      setOutput({ status: 1, stdout: "", stderr: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRunning(false);
    }
  }

  async function commitAndPush(options: { afterPull?: tauri.CommandOutput } = {}) {
    if (isRunning) return;
    setIsRunning(true);
    try {
      const parts: string[] = [];
      let statusCode = options.afterPull?.status ?? 0;
      let stderr = options.afterPull?.stderr ?? "";

      if (options.afterPull) {
        parts.push(`$ git pull --ff-only`, commandText(options.afterPull));
        if (options.afterPull.status !== 0) {
          setOutput({ status: options.afterPull.status, stdout: parts.filter(Boolean).join("\n\n"), stderr });
          return;
        }
      }

      const latestStatus = parseGitStatus(await tauri.gitStatus());
      if ((latestStatus?.files.length ?? 0) > 0) {
        const commit = await tauri.gitCommitAll(commitMessage());
        parts.push(`$ git add -A && git commit -m "${commitMessage()}"`, commandText(commit));
        statusCode = commit.status;
        stderr = [stderr, commit.stderr].filter(Boolean).join("\n");
        if (commit.status !== 0) {
          setOutput({ status: statusCode, stdout: parts.filter(Boolean).join("\n\n"), stderr });
          await refreshStatus();
          return;
        }
        setMessage("");
      }

      const push = await tauri.gitPush();
      parts.push(`$ git push`, commandText(push));
      statusCode = push.status;
      stderr = [stderr, push.stderr].filter(Boolean).join("\n");
      setOutput({ status: statusCode, stdout: parts.filter(Boolean).join("\n\n"), stderr });
      requestGitRefresh(options.afterPull ? "git-sync" : "git-commit-push");
      await refreshStatus();
      window.setTimeout(() => void refreshStatus(), 400);
    } catch (error) {
      setOutput({ status: 1, stdout: "", stderr: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRunning(false);
    }
  }

  async function openChangedFile(file: GitFileStatus) {
    const relativePath = normalizeGitStatusPath(file.path);
    const path = workspacePath(relativePath);
    if (!path) return;

    if (file.code.includes("D") && !(await tauri.fileExists(path).catch(() => false))) {
      setOutput({ status: 1, stdout: "", stderr: `File is deleted: ${relativePath}` });
      return;
    }

    if (isMarkdownPath(relativePath)) {
      await editorApi.navigateToFile(path);
      return;
    }

    const assetKind = assetKindFromPath(relativePath);
    if (assetKind) {
      editorApi.openAsset(path, assetKind);
      return;
    }

    await tauri.openPath(path);
  }

  async function revealChangedFile(file: GitFileStatus) {
    const relativePath = normalizeGitStatusPath(file.path);
    const path = workspacePath(relativePath);
    if (!path) return;
    await tauri.revealInFileManager(path);
  }

  async function showDiff(file: GitFileStatus | null) {
    const relativePath = file ? normalizeGitStatusPath(file.path) : null;
    await run(async () => {
      const result = await tauri.gitDiff(relativePath);
      if (result.status === 0 && !commandText(result)) {
        return {
          status: 0,
          stdout: relativePath
            ? `No text diff for ${relativePath}. The file may be untracked, binary, or already staged without unstaged edits.`
            : "No text diff in the working tree.",
          stderr: "",
        };
      }
      return result;
    });
  }

  async function sync() {
    if (isRunning) return;
    try {
      const pull = await tauri.gitPull();
      await commitAndPush({ afterPull: pull });
    } catch (error) {
      setOutput({ status: 1, stdout: "", stderr: error instanceof Error ? error.message : String(error) });
    }
  }

  if (isMissingGitRepository) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-subtle)] p-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={gitStateDotStyle("error")}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-[var(--text-secondary)]">
                No Git repository
              </div>
              <div className="text-[12px] text-[var(--text-muted)]">
                Initialize this vault to enable commits, diffs, and sync.
              </div>
            </div>
          </div>
        </div>
        <button
          className="right-sidebar-button"
          type="button"
          onClick={() => void run(tauri.gitInit)}
          disabled={isRunning}
        >
          Initialize Git
        </button>
        <OutputBlock output={output} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-subtle)] p-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_color-mix(in_srgb,currentColor_12%,transparent)]"
            style={gitStateDotStyle(summary.tone)}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-[var(--text-secondary)]">
              {summary.label}
            </div>
            <div className="truncate text-[12px] text-[var(--text-muted)]">
              {status
                ? `${status.branch}${status.upstream ? ` -> ${status.upstream}` : remotes.length > 0 ? " (no upstream)" : " (no remote)"} · ${formatCheckedAt(lastStatusAt)}`
                : commandText(statusOutput) || "Loading status..."}
            </div>
          </div>
          <PanelIconButton label="Refresh Git status" onClick={() => void refreshStatus()} disabled={isRunning}>
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={15} color="currentColor" strokeWidth={2} />
          </PanelIconButton>
        </div>
        {remotes.length > 0 && (
          <div className="mt-3 flex flex-col gap-1 rounded-md border border-[var(--line-subtler)] bg-[var(--surface-input)] p-2">
            {remotes.map((remote) => (
              <div
                key={remote.name}
                className="grid grid-cols-[64px_minmax(0,1fr)] gap-2 text-[12px]"
              >
                <span className="text-[var(--text-muted)]">{remote.name}</span>
                <span className="truncate font-mono text-[var(--text-secondary)]">{remote.url}</span>
              </div>
            ))}
          </div>
        )}
        {hasConflicts && (
          <div className="mt-3 rounded-md border border-[var(--line-subtler)] bg-[var(--surface-input)] p-2 text-[12px] text-[var(--text-secondary)]">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <HugeiconsIcon icon={AlertCircleIcon} size={14} color="currentColor" strokeWidth={2} />
              <span>
                {conflicts.length} merge conflict{conflicts.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="right-sidebar-button"
                onClick={() => {
                  const first = conflicts[0];
                  if (first) void openChangedFile(first);
                }}
              >
                Open First
              </button>
              <button
                type="button"
                className="right-sidebar-button"
                onClick={() => void showDiff(conflicts[0] ?? null)}
              >
                Show Diff
              </button>
            </div>
          </div>
        )}
        {status ? (
          <div className="mt-3 max-h-44 overflow-auto rounded-md border border-[var(--line-subtler)] bg-[var(--surface-input)] p-1">
            <div className="flex items-center justify-between px-2 py-1.5 text-[12px]">
              <span className="font-medium text-[var(--text-secondary)]">{gitChangeListTitle(status)}</span>
              <span className="text-[var(--text-muted)]">{formatCheckedAt(lastStatusAt)}</span>
            </div>
            {status.files.length === 0 ? (
              <div className="px-2 pb-2 text-[13px] text-[var(--text-muted)]">Working tree clean</div>
            ) : (
              <div className="border-t border-[var(--line-subtler)] pt-1">
                {status.files.map((file) => (
                  <div
                    key={`${file.code}-${file.path}`}
                    className={`grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2 rounded px-2 py-1.5 text-[12px] ${
                      selectedFile?.path === file.path ? "bg-[var(--surface-selected)]" : ""
                    }`}
                    onMouseDown={() => setSelectedFile(file)}
                  >
                    <span className={isConflictStatus(file.code) ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>
                      {gitStatusLabel(file.code)}
                    </span>
                    <span className="truncate font-mono text-[var(--text-secondary)]">{file.path}</span>
                    <span className="flex gap-1">
                      <PanelIconButton label={`Open ${file.path}`} onClick={() => void openChangedFile(file)}>
                        <HugeiconsIcon icon={FileViewIcon} size={14} color="currentColor" strokeWidth={2} />
                      </PanelIconButton>
                      <PanelIconButton label={`Reveal ${file.path}`} onClick={() => void revealChangedFile(file)}>
                        <HugeiconsIcon icon={FolderOpenIcon} size={14} color="currentColor" strokeWidth={2} />
                      </PanelIconButton>
                      <PanelIconButton label={`Diff ${file.path}`} onClick={() => void showDiff(file)}>
                        <HugeiconsIcon icon={FileDiffIcon} size={14} color="currentColor" strokeWidth={2} />
                      </PanelIconButton>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
      {isGitRepository && remotes.length === 0 && (
        <div className="grid grid-cols-[72px_minmax(0,1fr)_auto] gap-2">
          <input
            value={remoteName}
            onChange={(event) => setRemoteName(event.target.value)}
            placeholder="origin"
            className="h-8 rounded-md border border-[var(--line-subtler)] bg-[var(--surface-input)] px-3 text-[13px] outline-none focus:border-[var(--focus-border)]"
          />
          <input
            value={remoteUrl}
            onChange={(event) => setRemoteUrl(event.target.value)}
            placeholder="Remote URL"
            className="h-8 min-w-0 rounded-md border border-[var(--line-subtler)] bg-[var(--surface-input)] px-3 text-[13px] outline-none focus:border-[var(--focus-border)]"
          />
          <PanelIconButton
            label="Add Git remote"
            onClick={() =>
              void run(() => tauri.gitAddRemote(remoteName.trim() || "origin", remoteUrl.trim()), {
                clearRemote: true,
              })
            }
            disabled={isRunning || !remoteUrl.trim()}
          >
            <HugeiconsIcon icon={Link01Icon} size={15} color="currentColor" strokeWidth={2} />
          </PanelIconButton>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        <button
          className="right-sidebar-button"
          type="button"
          onClick={() => void checkRemote()}
          disabled={isRunning || !isGitRepository || hasConflicts}
        >
          Check
        </button>
        <button className="right-sidebar-button" type="button" onClick={() => void run(tauri.gitPull)} disabled={isRunning || !isGitRepository || hasConflicts}>
          <span className="inline-flex items-center justify-center gap-1.5">
            <HugeiconsIcon icon={ArrowDown01Icon} size={13} color="currentColor" strokeWidth={2} />
            Pull
          </span>
        </button>
        <button className="right-sidebar-button" type="button" onClick={() => void commitAndPush()} disabled={isRunning || !isGitRepository || hasConflicts}>
          <span className="inline-flex items-center justify-center gap-1.5">
            <HugeiconsIcon icon={ArrowUp01Icon} size={13} color="currentColor" strokeWidth={2} />
            Push
          </span>
        </button>
        <button
          className="right-sidebar-button"
          type="button"
          onClick={() => void sync()}
          disabled={isRunning || !isGitRepository || hasConflicts}
        >
          Sync
        </button>
      </div>
      <button className="right-sidebar-button" type="button" onClick={() => void showDiff(selectedFile)} disabled={isRunning || !isGitRepository}>
        Diff
      </button>
      <input
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={`Commit message (${DEFAULT_GIT_COMMIT_MESSAGE})`}
        className="h-8 rounded-md border border-[var(--line-subtler)] bg-[var(--surface-input)] px-3 text-[13px] outline-none focus:border-[var(--focus-border)]"
      />
      <button
        className="right-sidebar-button"
        type="button"
        disabled={isRunning || !isGitRepository || hasConflicts}
        onClick={() => void run(() => tauri.gitCommitAll(commitMessage()), { clearMessage: true })}
      >
        Commit All
      </button>
      <OutputBlock output={output} />
    </div>
  );
}

function PropertiesPanel() {
  const activePath = useActiveFilePath();
  const frontmatter = useFileFrontmatter(activePath);
  const entries = useMemo(() => parseYamlEntries(frontmatter ?? ""), [frontmatter]);
  const followFrontmatterLink = useCallback(
    async (raw: string) => {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) return;
      const target = await resolveWikiLink(
        raw,
        workspaceRoot,
        tauri.fuzzySearch,
        tauri.fileExists,
        activePath,
      );
      if (target.kind === "internal") {
        await editorApi.navigateToFile(target.path);
      }
    },
    [activePath],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
      {entries.length === 0 ? (
        <div className="text-[13px] text-[var(--text-muted)]">No properties</div>
      ) : (
        entries.map((entry, index) => (
          <div key={entry.key} className="rounded-lg bg-[var(--surface-subtle)] px-3 py-2">
            <div className="text-[12px] text-[var(--text-muted)]">{entry.key}</div>
            <div className="break-words text-[13px] text-[var(--text-secondary)]">
              {hasFrontmatterLinks(entry.value)
                ? parseFrontmatterLinks(entry.value).map((part, partIndex) =>
                    part.kind === "text" ? (
                      <span key={`${index}-${partIndex}`}>{part.text}</span>
                    ) : (
                      <button
                        key={`${index}-${partIndex}`}
                        type="button"
                        className="mx-0.5 max-w-full truncate rounded-md bg-[var(--surface-input)] px-1.5 py-0.5 align-baseline text-[12px] text-[var(--accent)] hover:bg-[var(--surface-selected)]"
                        onClick={() => {
                          void followFrontmatterLink(part.raw);
                        }}
                      >
                        {part.label}
                      </button>
                    ),
                  )
                : entry.value}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function OutlinePanel() {
  const activePath = useActiveFilePath();
  const content = useFileContent(activePath);
  const headings = useMemo(
    () =>
      content
        .split("\n")
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => /^#{1,6}\s+/.test(line))
        .map(({ line, index }) => ({
          index,
          depth: line.match(/^#+/)?.[0].length ?? 1,
          title: line.replace(/^#{1,6}\s+/, "").trim(),
        })),
    [content],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
      {headings.length === 0 ? (
        <div className="text-[13px] text-[var(--text-muted)]">No headings</div>
      ) : (
        headings.map((heading) => (
          <button
            type="button"
            key={`${heading.index}-${heading.title}`}
            disabled={!activePath}
            onClick={() => {
              if (activePath) jumpToEditorLine(activePath, heading.index + 1);
            }}
            className="truncate rounded-md px-2 py-1 text-left text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] disabled:opacity-50"
            style={{ paddingLeft: 8 + (heading.depth - 1) * 12 }}
          >
            {heading.title}
          </button>
        ))
      )}
    </div>
  );
}

export function RightSidebar() {
  const view = useUIStore((state) => state.rightSidebarView);
  const setView = useUIStore((state) => state.setRightSidebarView);
  const setRightSidebarOpen = useUIStore((state) => state.setRightSidebarOpen);
  const [mountedViews, setMountedViews] = useState<Set<RightSidebarView>>(() => new Set([view]));

  useEffect(() => {
    setMountedViews((current) => {
      if (current.has(view)) return current;
      const next = new Set(current);
      next.add(view);
      return next;
    });
  }, [view]);

  const panelClass = (candidate: RightSidebarView) =>
    candidate === view ? "flex min-h-0 flex-1 flex-col" : "hidden";

  const isMounted = (candidate: RightSidebarView) => mountedViews.has(candidate) || candidate === view;

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-[var(--line-subtle)] bg-[var(--bg)] pt-[var(--chrome-control-padding)]">
      <div className="flex items-center gap-1 border-b border-[var(--line-subtle)] px-3 py-2">
        <div className="grid min-w-0 flex-1 grid-cols-5 gap-1 rounded-md bg-[var(--surface-subtle)] p-1">
          {VIEWS.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              title={candidate.label}
              aria-label={candidate.label}
              onClick={() => setView(candidate.id)}
              className={`flex h-7 items-center justify-center rounded-[5px] transition-[background-color,color] duration-[var(--motion-quick-duration)] ease-[var(--motion-soft-ease)] ${
                view === candidate.id
                  ? "bg-[var(--surface-selected)] text-[var(--text-secondary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <HugeiconsIcon icon={candidate.icon} size={15} color="currentColor" strokeWidth={2} />
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Close right sidebar"
          title="Close right sidebar"
          onClick={() => setRightSidebarOpen(false)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-[background-color,color] duration-[var(--motion-quick-duration)] ease-[var(--motion-soft-ease)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-secondary)]"
        >
          <HugeiconsIcon icon={PanelRightCloseIcon} size={16} color="currentColor" strokeWidth={2} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3">
        {isMounted("agent") && (
          <div className={panelClass("agent")} aria-hidden={view !== "agent"}>
            <AgentPanel />
          </div>
        )}
        {isMounted("terminal") && (
          <div className={panelClass("terminal")} aria-hidden={view !== "terminal"}>
            <TerminalPanel />
          </div>
        )}
        {isMounted("git") && (
          <div className={panelClass("git")} aria-hidden={view !== "git"}>
            <GitPanel isActive={view === "git"} />
          </div>
        )}
        {isMounted("properties") && (
          <div className={panelClass("properties")} aria-hidden={view !== "properties"}>
            <PropertiesPanel />
          </div>
        )}
        {isMounted("outline") && (
          <div className={panelClass("outline")} aria-hidden={view !== "outline"}>
            <OutlinePanel />
          </div>
        )}
      </div>
    </aside>
  );
}
