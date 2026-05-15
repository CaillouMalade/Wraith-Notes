import { useMemo } from "react";
import { useSetting, useSetSetting } from "@/hooks/use-settings";
import {
  AGENT_PROFILES_SETTING_KEY,
  createAgentProfile,
  parseAgentProfiles,
  serializeAgentProfiles,
  type AgentProfile,
} from "@/lib/agent-profiles";

function TextInput({
  value,
  onChange,
  placeholder,
  mono = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`h-9 min-w-0 rounded-lg border border-transparent bg-[var(--surface-input)] px-3 text-[0.8125rem] text-[var(--text-secondary)] outline-none focus:border-[var(--focus-border)] ${
        mono ? "font-mono text-[0.75rem]" : "font-[inherit]"
      }`}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className="relative h-5 w-9 rounded-full transition-colors duration-200"
      style={{ backgroundColor: checked ? "var(--link-color)" : "var(--border-color)" }}
    >
      <span
        className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 ease-out"
        style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
      />
    </button>
  );
}

export function AgentProfilesSection() {
  const rawProfiles = useSetting(AGENT_PROFILES_SETTING_KEY);
  const setSetting = useSetSetting();
  const profiles = useMemo(() => parseAgentProfiles(rawProfiles), [rawProfiles]);

  function save(nextProfiles: AgentProfile[]) {
    void setSetting(AGENT_PROFILES_SETTING_KEY, serializeAgentProfiles(nextProfiles));
  }

  function updateProfile(id: string, patch: Partial<AgentProfile>) {
    save(profiles.map((profile) => (profile.id === id ? { ...profile, ...patch } : profile)));
  }

  function removeProfile(id: string) {
    save(profiles.filter((profile) => profile.id !== id));
  }

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[0.8125rem] font-medium text-[var(--text-muted)]">Agents</h2>
      <div className="-mx-4 overflow-hidden rounded-2xl border border-[var(--line-subtler)] bg-[var(--surface-card)]">
        {profiles.map((profile, index) => (
          <div
            key={profile.id}
            className={`px-4 py-3.5 ${index === 0 ? "" : "border-t border-[var(--line-subtler)]"}`}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-[0.8125rem] font-medium text-[var(--text-primary)]">
                  {profile.name || "Unnamed agent"}
                </div>
                <div className="mt-0.5 text-[0.8125rem] text-[var(--text-muted)]">
                  Local command profile for the Agent sidebar.
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Toggle
                  checked={profile.enabled}
                  label={`Enable ${profile.name || "agent"}`}
                  onChange={(enabled) => updateProfile(profile.id, { enabled })}
                />
                <button
                  type="button"
                  onClick={() => removeProfile(profile.id)}
                  className="rounded-full px-2 py-0.5 text-[0.6875rem] text-[var(--text-muted)] hover:bg-[var(--surface-subtle-strong)] hover:text-[var(--text-primary)]"
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3">
                <label className="text-[0.75rem] text-[var(--text-muted)]">Name</label>
                <TextInput
                  value={profile.name}
                  onChange={(name) => updateProfile(profile.id, { name })}
                  placeholder="Codex"
                />
              </div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3">
                <label className="text-[0.75rem] text-[var(--text-muted)]">Command</label>
                <TextInput
                  value={profile.command}
                  onChange={(command) => updateProfile(profile.id, { command })}
                  placeholder="codex exec --skip-git-repo-check --json {prompt}"
                  mono
                />
              </div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3">
                <label className="text-[0.75rem] text-[var(--text-muted)]">Working Dir</label>
                <TextInput
                  value={profile.workingDirectory}
                  onChange={(workingDirectory) =>
                    updateProfile(profile.id, { workingDirectory })
                  }
                  placeholder="vault root"
                  mono
                />
              </div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3">
                <label className="text-[0.75rem] text-[var(--text-muted)]">Notes</label>
                <TextInput
                  value={profile.notes}
                  onChange={(notes) => updateProfile(profile.id, { notes })}
                  placeholder="Optional memory"
                />
              </div>
            </div>
          </div>
        ))}
        <div className="border-t border-[var(--line-subtler)] p-3">
          <button
            type="button"
            onClick={() => save([...profiles, createAgentProfile()])}
            className="flex h-9 w-full items-center justify-center rounded-lg border border-dashed border-[var(--line-subtle)] text-[0.8125rem] text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            + Add Agent
          </button>
        </div>
      </div>
    </section>
  );
}
