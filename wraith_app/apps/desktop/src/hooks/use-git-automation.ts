import { useEffect, useMemo, useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { requestGitRefresh } from "@/lib/git-refresh";
import * as tauri from "@/lib/tauri";

type ParsedStatus = {
  clean: boolean;
  hasConflicts: boolean;
  fileCount: number;
};

function numberSetting(settings: Record<string, unknown>, key: string, fallback: number) {
  const value = settings[key];
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function parseStatus(output: tauri.CommandOutput): ParsedStatus | null {
  if (output.status !== 0) return null;
  const files = output.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.startsWith("## "))
    .map((line) => line.slice(0, 2).trim() || "?");

  return {
    clean: files.length === 0,
    fileCount: files.length,
    hasConflicts: files.some((code) => code.includes("U") || code === "AA" || code === "DD"),
  };
}

function hasRemote(output: tauri.CommandOutput) {
  return output.status === 0 && output.stdout.trim().length > 0;
}

function hasOpenDirtyFiles() {
  for (const file of useEditorStore.getState().openFiles.values()) {
    if (file.isDirty || file.isLoading) return true;
  }
  return false;
}

function autoCheckpointMessage(trigger: "idle" | "inactive") {
  const timestamp = new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");
  return `AutoGit checkpoint (${trigger}) ${timestamp}`;
}

async function maybePush(hasConfiguredRemote: boolean) {
  if (!hasConfiguredRemote) return;
  const push = await tauri.gitPush();
  if (push.status !== 0) {
    console.warn("[git-automation] AutoGit push failed", push.stderr || push.stdout);
    return;
  }
  requestGitRefresh("autogit-push");
}

export function useGitAutomation() {
  const root = useWorkspaceStore((state) => state.root);
  const settings = useSettingsStore((state) => state.settings);
  const activitySignature = useEditorStore((state) =>
    Array.from(state.openFiles.values())
      .map((file) => `${file.path}:${file.content.length}:${file.diskContent.length}:${file.isDirty}`)
      .join("|"),
  );

  const config = useMemo(
    () => ({
      autoPullEnabled: settings["git.auto-pull-enabled"] === true,
      autoPullIntervalMs:
        numberSetting(settings, "git.auto-pull-interval-minutes", 5) * 60_000,
      autoGitEnabled: settings["git.autogit-enabled"] === true,
      autoGitIdleMs:
        numberSetting(settings, "git.autogit-idle-threshold-seconds", 90) * 1_000,
      autoGitInactiveMs:
        numberSetting(settings, "git.autogit-inactive-threshold-seconds", 30) * 1_000,
    }),
    [settings],
  );

  const lastActivityAtRef = useRef(Date.now());
  const inactiveSinceRef = useRef<number | null>(document.hidden ? Date.now() : null);
  const lastPullAtRef = useRef(0);
  const isRunningRef = useRef(false);

  useEffect(() => {
    lastActivityAtRef.current = Date.now();
  }, [activitySignature]);

  useEffect(() => {
    const markActive = () => {
      inactiveSinceRef.current = null;
    };
    const markInactive = () => {
      inactiveSinceRef.current = Date.now();
    };
    const handleVisibility = () => {
      if (document.hidden) {
        markInactive();
      } else {
        markActive();
      }
    };

    window.addEventListener("focus", markActive);
    window.addEventListener("blur", markInactive);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", markActive);
      window.removeEventListener("blur", markInactive);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!root || (!config.autoPullEnabled && !config.autoGitEnabled)) return;

    async function tick() {
      if (isRunningRef.current) return;
      isRunningRef.current = true;
      try {
        const statusOutput = await tauri.gitStatus();
        const status = parseStatus(statusOutput);
        if (!status || status.hasConflicts) return;

        const remotes = await tauri.gitRemotes().catch(() => null);
        const configuredRemote = remotes ? hasRemote(remotes) : false;
        const now = Date.now();

        if (
          config.autoPullEnabled &&
          configuredRemote &&
          status.clean &&
          now - lastPullAtRef.current >= config.autoPullIntervalMs
        ) {
          lastPullAtRef.current = now;
          const pull = await tauri.gitPull();
          if (pull.status !== 0) {
            console.warn("[git-automation] Auto pull failed", pull.stderr || pull.stdout);
          } else {
            requestGitRefresh("auto-pull");
          }
        }

        if (!config.autoGitEnabled || status.fileCount === 0 || hasOpenDirtyFiles()) return;

        const idleReady = now - lastActivityAtRef.current >= config.autoGitIdleMs;
        const inactiveSince = inactiveSinceRef.current;
        const inactiveReady =
          inactiveSince !== null && now - inactiveSince >= config.autoGitInactiveMs;
        if (!idleReady && !inactiveReady) return;

        const trigger = inactiveReady ? "inactive" : "idle";
        const commit = await tauri.gitCommitAll(autoCheckpointMessage(trigger));
        lastActivityAtRef.current = now;
        if (commit.status !== 0) {
          console.warn("[git-automation] AutoGit commit failed", commit.stderr || commit.stdout);
          return;
        }
        requestGitRefresh("autogit-commit");
        await maybePush(configuredRemote);
      } catch (error) {
        console.warn("[git-automation] Automation tick failed", error);
      } finally {
        isRunningRef.current = false;
      }
    }

    const interval = window.setInterval(() => void tick(), 5_000);
    return () => window.clearInterval(interval);
  }, [config, root]);
}
