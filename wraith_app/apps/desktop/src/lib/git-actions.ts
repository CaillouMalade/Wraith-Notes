import { requestGitRefresh } from "@/lib/git-refresh";
import * as tauri from "@/lib/tauri";

export type GitShortcutAction = "check" | "pull" | "push" | "sync";

export const DEFAULT_GIT_COMMIT_MESSAGE = "Update vault";

function gitStatusHasFiles(output: tauri.CommandOutput) {
  if (output.status !== 0) return false;
  const lines = output.stdout.split(/\r?\n/).filter(Boolean);
  return lines.some((line) => !line.startsWith("## "));
}

export async function gitCommitAndPush(message = DEFAULT_GIT_COMMIT_MESSAGE) {
  const status = await tauri.gitStatus();
  if (status.status !== 0) return status;

  if (gitStatusHasFiles(status)) {
    const commit = await tauri.gitCommitAll(message);
    if (commit.status !== 0) return commit;
  }

  return tauri.gitPush();
}

export async function runGitShortcutAction(action: GitShortcutAction) {
  let output: tauri.CommandOutput;
  if (action === "check") {
    const fetch = await tauri.gitFetch();
    output = fetch.status === 0 ? await tauri.gitStatus() : fetch;
  } else if (action === "pull") {
    output = await tauri.gitPull();
  } else if (action === "push") {
    output = await gitCommitAndPush();
  } else {
    const pull = await tauri.gitPull();
    output = pull.status === 0 ? await gitCommitAndPush() : pull;
  }

  requestGitRefresh(`git-shortcut-${action}`);
  return output;
}
