/**
 * Sync Service - Manages cloud synchronization for Marginalia
 * Supports: Dropbox, GitHub (future)
 */

// Types for sync data
export interface SyncData {
  version: number;
  lastModified: string;
  annotations: Record<string, unknown>;
  bookmarks: Record<string, unknown>;
  bibtex: Record<string, unknown>;
  mindMaps: Record<string, unknown>;
  studyGroups: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export interface SyncStatus {
  provider: "dropbox" | "github" | null;
  connected: boolean;
  lastSync: string | null;
  syncInProgress: boolean;
  error: string | null;
}

export interface SyncConflict {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  localTimestamp: string;
  remoteTimestamp: string;
}

// Collect all sync data from localStorage
export function collectSyncData(): SyncData {
  const getData = (key: string) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  };

  return {
    version: 1,
    lastModified: new Date().toISOString(),
    annotations: getData("marginalia-annotations") || {},
    bookmarks: getData("marginalia-bookmarks") || {},
    bibtex: getData("marginalia-bibtex") || {},
    mindMaps: getData("marginalia-mind-maps") || {},
    studyGroups: getData("marginalia-study-groups") || {},
    settings: getData("marginalia-settings") || {},
  };
}

// Apply sync data to localStorage
export function applySyncData(data: SyncData): void {
  const setData = (key: string, value: unknown) => {
    if (value && Object.keys(value as object).length > 0) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  setData("marginalia-annotations", data.annotations);
  setData("marginalia-bookmarks", data.bookmarks);
  setData("marginalia-bibtex", data.bibtex);
  setData("marginalia-mind-maps", data.mindMaps);
  setData("marginalia-study-groups", data.studyGroups);
  setData("marginalia-settings", data.settings);
}

// Merge sync data (simple last-write-wins strategy)
export function mergeSyncData(local: SyncData, remote: SyncData): SyncData {
  const localTime = new Date(local.lastModified).getTime();
  const remoteTime = new Date(remote.lastModified).getTime();

  // Simple strategy: use the most recent data
  // For more complex merging, we'd need to compare individual items
  if (remoteTime > localTime) {
    return {
      ...remote,
      lastModified: new Date().toISOString(),
    };
  }

  return {
    ...local,
    lastModified: new Date().toISOString(),
  };
}

// Export sync data as JSON file (for manual backup)
export function exportSyncData(): void {
  const data = collectSyncData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `marginalia-backup-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import sync data from JSON file
export function importSyncData(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as SyncData;
        if (data.version && data.lastModified) {
          applySyncData(data);
          resolve();
        } else {
          reject(new Error("Invalid sync data format"));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
