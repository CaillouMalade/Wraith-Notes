export interface AgentProfile {
  id: string;
  name: string;
  command: string;
  enabled: boolean;
  workingDirectory: string;
  notes: string;
}

export const AGENT_PROFILES_SETTING_KEY = "agents.profiles";

export const DEFAULT_AGENT_PROFILES: AgentProfile[] = [
  {
    id: "codex",
    name: "Codex",
    command: "codex exec --skip-git-repo-check {prompt}",
    enabled: true,
    workingDirectory: "",
    notes: "Local Codex CLI.",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    command: "claude -p {prompt}",
    enabled: true,
    workingDirectory: "",
    notes: "Arthur can replace this with his local Claude Code command.",
  },
  {
    id: "hermes",
    name: "Hermes",
    command: "hermes {prompt}",
    enabled: true,
    workingDirectory: "",
    notes: "Local Hermes CLI.",
  },
];

export function serializeAgentProfile(profile: AgentProfile): string {
  return JSON.stringify(profile);
}

export function serializeAgentProfiles(profiles: AgentProfile[]): string[] {
  return profiles.map(serializeAgentProfile);
}

function normalizeAgentProfile(value: unknown, index: number): AgentProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const displayName =
    typeof raw.displayName === "string" ? raw.displayName.trim() : name;
  const command = typeof raw.command === "string" ? raw.command.trim() : "";
  if (!displayName) return null;

  return {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "agent"}-${index}`,
    name: displayName,
    command,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
    workingDirectory:
      typeof raw.workingDirectory === "string"
        ? raw.workingDirectory
        : typeof raw.cwd === "string"
          ? raw.cwd
          : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

export function parseAgentProfiles(value: unknown): AgentProfile[] {
  if (!Array.isArray(value)) return DEFAULT_AGENT_PROFILES;
  const rawItems = value;
  const profiles = rawItems
    .map((item, index) => {
      if (typeof item === "string") {
        try {
          return normalizeAgentProfile(JSON.parse(item), index);
        } catch {
          return null;
        }
      }
      return normalizeAgentProfile(item, index);
    })
    .filter((profile): profile is AgentProfile => profile !== null);

  return profiles;
}

export function createAgentProfile(): AgentProfile {
  const id = `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name: "New agent",
    command: "",
    enabled: true,
    workingDirectory: "",
    notes: "",
  };
}
