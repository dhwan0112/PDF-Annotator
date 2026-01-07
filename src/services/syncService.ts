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
  library: LibrarySyncData | null;
}

// Library sync data (simplified version without full paths)
export interface LibrarySyncData {
  documents: SyncDocument[];
  projects: SyncProject[];
}

export interface SyncDocument {
  id: string;
  fileName: string;  // Just the filename, not full path
  title: string | null;
  author: string | null;
  pageCount: number | null;
  lastPage: number;
  projectId: string | null;
  studyGroupId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncProject {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
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

// Extract filename from path (cross-platform)
function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

// Convert path-keyed annotations to filename-keyed for sync
function convertAnnotationsToFilenameKeys(annotations: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [path, data] of Object.entries(annotations)) {
    const fileName = getFileName(path);
    result[fileName] = data;
  }
  return result;
}

// Convert filename-keyed annotations back to path-keyed (matching local files)
function convertAnnotationsToPathKeys(
  annotations: Record<string, unknown>,
  localAnnotations: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...localAnnotations };

  // Create a map of filename -> local path
  const fileNameToPath: Record<string, string> = {};
  for (const path of Object.keys(localAnnotations)) {
    const fileName = getFileName(path);
    fileNameToPath[fileName] = path;
  }

  // Apply remote annotations using matched paths
  for (const [fileName, data] of Object.entries(annotations)) {
    if (fileNameToPath[fileName]) {
      // Use existing local path
      result[fileNameToPath[fileName]] = data;
    } else {
      // Keep filename as key for files not yet opened locally
      result[fileName] = data;
    }
  }

  return result;
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

  // Get annotations and convert to filename-based keys for sync
  const rawAnnotations = getData("marginalia-annotations") || {};
  const filenameAnnotations = convertAnnotationsToFilenameKeys(rawAnnotations);

  // Get bookmarks and convert to filename-based keys
  const rawBookmarks = getData("marginalia-bookmarks") || {};
  const filenameBookmarks = convertAnnotationsToFilenameKeys(rawBookmarks);

  return {
    version: 2,  // Version 2 uses filename-based keys
    lastModified: new Date().toISOString(),
    annotations: filenameAnnotations,
    bookmarks: filenameBookmarks,
    bibtex: getData("marginalia-bibtex") || {},
    mindMaps: getData("marginalia-mind-maps") || {},
    studyGroups: getData("marginalia-study-groups") || {},
    settings: getData("marginalia-settings") || {},
    library: null, // Library is synced separately via database
  };
}

// Apply sync data to localStorage
export function applySyncData(data: SyncData): void {
  const getData = (key: string) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : {};
    } catch {
      return {};
    }
  };

  const setData = (key: string, value: unknown) => {
    if (value && Object.keys(value as object).length > 0) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  // Convert filename-based keys back to path-based keys using local data
  const localAnnotations = getData("marginalia-annotations");
  const localBookmarks = getData("marginalia-bookmarks");

  const mergedAnnotations = convertAnnotationsToPathKeys(
    data.annotations as Record<string, unknown>,
    localAnnotations
  );
  const mergedBookmarks = convertAnnotationsToPathKeys(
    data.bookmarks as Record<string, unknown>,
    localBookmarks
  );

  setData("marginalia-annotations", mergedAnnotations);
  setData("marginalia-bookmarks", mergedBookmarks);
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
