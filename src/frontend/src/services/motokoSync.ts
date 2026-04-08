// Motoko sync service — handles IC0508 gracefully
// Backend has no share methods in this project, so this is a stub

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "stopped";

let syncStatus: SyncStatus = "idle";
let lastError = "";
const listeners: Array<(status: SyncStatus, error: string) => void> = [];

function notify(status: SyncStatus, error = "") {
  syncStatus = status;
  lastError = error;
  for (const l of listeners) l(status, error);
}

export function onSyncStatus(cb: (status: SyncStatus, error: string) => void) {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function getLastError(): string {
  return lastError;
}

export async function saveToMotoko(_data: string): Promise<boolean> {
  // Backend has no data storage methods in this project
  // Always return false gracefully
  notify("stopped", "IC0508: Backend storage not configured");
  return false;
}

export async function loadFromMotoko(): Promise<string | null> {
  return null;
}
