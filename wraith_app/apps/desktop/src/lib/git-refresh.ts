export const GIT_REFRESH_EVENT = "wraith:git-refresh";

export function requestGitRefresh(reason = "changed") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GIT_REFRESH_EVENT, { detail: { reason } }));
}
