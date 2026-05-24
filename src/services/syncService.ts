/**
 * Sync Service - Vector Clock based synchronization for Marginalia
 * Supports: Dropbox, GitHub (future)
 */

import { syncAllPdfs, type PdfSyncResult } from "./fileStorageService";
import {
  type VectorClock,
  type ConflictItem,
  type EntityType,
  type SyncChangeLog,
  VectorClockUtils,
  generateDeviceId,
} from "../types/sync";

// Types for sync data
export interface SyncData {
  version: number;
  deviceId: string;
  lastModified: string;
  vectorClock: VectorClock;
  annotations: SyncEntity<Record<string, unknown>>;
  bookmarks: SyncEntity<Record<string, unknown>>;
  bibtex: SyncEntity<Record<string, unknown>>;
  mindMaps: SyncEntity<Record<string, unknown>>;
  studyGroups: SyncEntity<Record<string, unknown>>;
  settings: SyncEntity<Record<string, unknown>>;
  library: LibrarySyncData | null;
  pdfFiles?: PdfFileReference[];
  session?: SessionState;
  changeLog?: SyncChangeLog[];
}

// Entity with vector clock for per-item tracking
export interface SyncEntity<T> {
  data: T;
  vectorClock: VectorClock;
  lastModified: string;
}

// Reference to a PDF file for sync
export interface PdfFileReference {
  fileName: string;
  studyGroupName: string | null;
  dropboxPath: string | null;
}

// Library sync data (simplified version without full paths)
export interface LibrarySyncData {
  documents: SyncDocument[];
  projects: SyncProject[];
}

export interface SyncDocument {
  id: string;
  fileName: string;
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

export interface SessionState {
  tabs: SessionTab[];
  activeTabIndex: number;
  deviceTimestamps: Record<string, number>;
}

export interface SessionTab {
  fileName: string;
  documentId: string | null;
  currentPage: number;
  scrollPosition: number;
  zoomLevel: number;
  groupId: string | null;
}

export interface MergeResult {
  data: SyncData;
  conflicts: ConflictItem[];
  hasConflicts: boolean;
}

// Get the current device ID
const deviceId = generateDeviceId();

// Local vector clock state (persisted)
function getLocalVectorClock(): VectorClock {
  try {
    const stored = localStorage.getItem("marginalia-vector-clock");
    if (stored) return JSON.parse(stored);
  } catch {
    // Ignore parse errors
  }
  return VectorClockUtils.create(deviceId);
}

function saveLocalVectorClock(clock: VectorClock): void {
  localStorage.setItem("marginalia-vector-clock", JSON.stringify(clock));
}

function incrementLocalClock(): VectorClock {
  const clock = VectorClockUtils.increment(getLocalVectorClock(), deviceId);
  saveLocalVectorClock(clock);
  return clock;
}

// Extract filename from path (cross-platform)
function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

// Convert path-keyed data to filename-keyed for sync
function convertToFilenameKeys(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(data)) {
    const fileName = getFileName(path);
    result[fileName] = value;
  }
  return result;
}

// Convert filename-keyed data back to path-keyed (matching local files)
function convertToPathKeys(
  remoteData: Record<string, unknown>,
  localData: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...localData };

  // Create a map of filename -> local path
  const fileNameToPath: Record<string, string> = {};
  for (const path of Object.keys(localData)) {
    const fileName = getFileName(path);
    fileNameToPath[fileName] = path;
  }

  // Apply remote data using matched paths
  for (const [fileName, data] of Object.entries(remoteData)) {
    if (fileNameToPath[fileName]) {
      result[fileNameToPath[fileName]] = data;
    } else {
      result[fileName] = data;
    }
  }

  return result;
}

// Create a sync entity wrapper
function createSyncEntity<T>(data: T): SyncEntity<T> {
  return {
    data,
    vectorClock: getLocalVectorClock(),
    lastModified: new Date().toISOString(),
  };
}

// Collect session state from tab store
function collectSessionState(): SessionState {
  try {
    const tabData = localStorage.getItem("marginalia-tabs");
    if (!tabData) {
      return { tabs: [], activeTabIndex: -1, deviceTimestamps: { [deviceId]: Date.now() } };
    }

    const parsed = JSON.parse(tabData);
    const state = parsed.state || parsed;
    const tabs = state.tabs || [];
    const activeTabId = state.activeTabId;

    const sessionTabs: SessionTab[] = tabs.map((tab: {
      filePath: string;
      documentId: string | null;
      currentPage: number;
      scrollPosition: number;
      zoomLevel: number;
      groupId: string | null;
    }) => ({
      fileName: getFileName(tab.filePath),
      documentId: tab.documentId,
      currentPage: tab.currentPage,
      scrollPosition: tab.scrollPosition,
      zoomLevel: tab.zoomLevel,
      groupId: tab.groupId,
    }));

    const activeTabIndex = tabs.findIndex((t: { id: string }) => t.id === activeTabId);

    return {
      tabs: sessionTabs,
      activeTabIndex,
      deviceTimestamps: { [deviceId]: Date.now() },
    };
  } catch {
    return { tabs: [], activeTabIndex: -1, deviceTimestamps: { [deviceId]: Date.now() } };
  }
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

  // Get annotations and convert to filename-based keys
  const rawAnnotations = getData("marginalia-annotations") || {};
  const filenameAnnotations = convertToFilenameKeys(rawAnnotations);

  // Get bookmarks and convert to filename-based keys
  const rawBookmarks = getData("marginalia-bookmarks") || {};
  const filenameBookmarks = convertToFilenameKeys(rawBookmarks);

  const currentClock = incrementLocalClock();

  return {
    version: 3, // Version 3 includes vector clocks
    deviceId,
    lastModified: new Date().toISOString(),
    vectorClock: currentClock,
    annotations: createSyncEntity(filenameAnnotations),
    bookmarks: createSyncEntity(filenameBookmarks),
    bibtex: createSyncEntity(getData("marginalia-bibtex") || {}),
    mindMaps: createSyncEntity(getData("marginalia-mind-maps") || {}),
    studyGroups: createSyncEntity(getData("marginalia-study-groups") || {}),
    settings: createSyncEntity(getData("marginalia-settings") || {}),
    library: null,
    session: collectSessionState(),
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

  // Handle both version 2 (no vector clocks) and version 3 (with vector clocks)
  const getEntityData = (entity: SyncEntity<Record<string, unknown>> | Record<string, unknown>): Record<string, unknown> => {
    if ('data' in entity && 'vectorClock' in entity) {
      return entity.data as Record<string, unknown>;
    }
    return entity as Record<string, unknown>;
  };

  // Convert filename-based keys back to path-based keys
  const localAnnotations = getData("marginalia-annotations");
  const localBookmarks = getData("marginalia-bookmarks");

  const annotationsData = getEntityData(data.annotations);
  const bookmarksData = getEntityData(data.bookmarks);

  const mergedAnnotations = convertToPathKeys(annotationsData, localAnnotations);
  const mergedBookmarks = convertToPathKeys(bookmarksData, localBookmarks);

  setData("marginalia-annotations", mergedAnnotations);
  setData("marginalia-bookmarks", mergedBookmarks);
  setData("marginalia-bibtex", getEntityData(data.bibtex));
  setData("marginalia-mind-maps", getEntityData(data.mindMaps));
  setData("marginalia-study-groups", getEntityData(data.studyGroups));
  setData("marginalia-settings", getEntityData(data.settings));

  // Update local vector clock to merged state
  if (data.vectorClock) {
    const mergedClock = VectorClockUtils.merge(getLocalVectorClock(), data.vectorClock);
    saveLocalVectorClock(mergedClock);
  }
}

// Apply session state from remote (if newer)
export function applySessionState(
  remoteSession: SessionState | undefined,
  localFilePaths: string[]
): boolean {
  if (!remoteSession || remoteSession.tabs.length === 0) {
    return false;
  }

  // Check if session sync is enabled in settings
  const settings = localStorage.getItem("marginalia-settings");
  let syncSession = false;
  try {
    if (settings) {
      const parsed = JSON.parse(settings);
      syncSession = parsed.syncSession === true;
    }
  } catch {
    // Ignore
  }

  if (!syncSession) {
    return false;
  }

  // Check if remote is more recent
  const remoteTimestamp = Math.max(...Object.values(remoteSession.deviceTimestamps));
  const localTabData = localStorage.getItem("marginalia-tabs");
  let localTimestamp = 0;
  try {
    if (localTabData) {
      const parsed = JSON.parse(localTabData);
      localTimestamp = parsed.lastUpdated || 0;
    }
  } catch {
    // Ignore
  }

  if (localTimestamp >= remoteTimestamp) {
    return false;
  }

  // Build filename to path map
  const fileNameToPath: Record<string, string> = {};
  for (const path of localFilePaths) {
    const fileName = getFileName(path);
    fileNameToPath[fileName] = path;
  }

  // Create new tabs matching local paths
  const newTabs = remoteSession.tabs
    .filter(tab => fileNameToPath[tab.fileName])
    .map((tab, index) => ({
      id: `tab-sync-${Date.now()}-${index}`,
      filePath: fileNameToPath[tab.fileName],
      documentId: tab.documentId,
      metadata: null,
      currentPage: tab.currentPage,
      totalPages: 0,
      zoomLevel: tab.zoomLevel,
      rotation: 0,
      viewMode: "continuous" as const,
      scrollPosition: tab.scrollPosition,
      groupId: tab.groupId,
    }));

  if (newTabs.length > 0) {
    const activeTabId = remoteSession.activeTabIndex >= 0 && remoteSession.activeTabIndex < newTabs.length
      ? newTabs[remoteSession.activeTabIndex].id
      : newTabs[0].id;

    localStorage.setItem("marginalia-tabs", JSON.stringify({
      state: { tabs: newTabs, activeTabId },
      version: 0,
      lastUpdated: Date.now(),
    }));
    return true;
  }

  return false;
}

// Detect conflicts between two sync entities
function detectEntityConflict<T>(
  local: SyncEntity<T> | T,
  remote: SyncEntity<T> | T,
  entityType: EntityType,
  entityId: string
): ConflictItem | null {
  // Handle legacy data without vector clocks
  const localEntity = 'vectorClock' in (local as object)
    ? local as SyncEntity<T>
    : { data: local, vectorClock: getLocalVectorClock(), lastModified: new Date().toISOString() };

  const remoteEntity = 'vectorClock' in (remote as object)
    ? remote as SyncEntity<T>
    : { data: remote, vectorClock: {}, lastModified: new Date().toISOString() };

  // Check if clocks are concurrent (neither dominates)
  if (VectorClockUtils.isConcurrent(localEntity.vectorClock, remoteEntity.vectorClock)) {
    // Check if data is actually different
    const localJson = JSON.stringify(localEntity.data);
    const remoteJson = JSON.stringify(remoteEntity.data);

    if (localJson !== remoteJson) {
      return {
        id: `${entityType}-${entityId}`,
        entityType,
        entityId,
        entityName: entityId,
        localVersion: {
          id: crypto.randomUUID(),
          deviceId,
          timestamp: new Date(localEntity.lastModified).getTime(),
          entityType,
          entityId,
          operation: "update",
          payload: localJson,
          vectorClock: localEntity.vectorClock,
        },
        remoteVersion: {
          id: crypto.randomUUID(),
          deviceId: "remote",
          timestamp: new Date(remoteEntity.lastModified).getTime(),
          entityType,
          entityId,
          operation: "update",
          payload: remoteJson,
          vectorClock: remoteEntity.vectorClock,
        },
        localData: localEntity.data,
        remoteData: remoteEntity.data,
      };
    }
  }

  return null;
}

// Merge sync data with conflict detection
export function mergeSyncData(local: SyncData, remote: SyncData): MergeResult {
  const conflicts: ConflictItem[] = [];

  // Helper to merge entities
  const mergeEntity = <T>(
    localEntity: SyncEntity<T> | T,
    remoteEntity: SyncEntity<T> | T,
    entityType: EntityType,
    entityId: string
  ): SyncEntity<T> => {
    const conflict = detectEntityConflict(localEntity, remoteEntity, entityType, entityId);

    if (conflict) {
      conflicts.push(conflict);
      // Default: use remote for now, will be resolved by user
      const remoteData = 'data' in (remoteEntity as object)
        ? (remoteEntity as SyncEntity<T>).data
        : remoteEntity as T;
      return {
        data: remoteData,
        vectorClock: VectorClockUtils.merge(
          'vectorClock' in (localEntity as object) ? (localEntity as SyncEntity<T>).vectorClock : {},
          'vectorClock' in (remoteEntity as object) ? (remoteEntity as SyncEntity<T>).vectorClock : {}
        ),
        lastModified: new Date().toISOString(),
      };
    }

    // No conflict - use the dominant version
    const localClock = 'vectorClock' in (localEntity as object)
      ? (localEntity as SyncEntity<T>).vectorClock
      : getLocalVectorClock();
    const remoteClock = 'vectorClock' in (remoteEntity as object)
      ? (remoteEntity as SyncEntity<T>).vectorClock
      : {};

    const comparison = VectorClockUtils.compare(localClock, remoteClock);

    if (comparison >= 0) {
      // Local dominates or equal
      const localData = 'data' in (localEntity as object)
        ? (localEntity as SyncEntity<T>).data
        : localEntity as T;
      return {
        data: localData,
        vectorClock: VectorClockUtils.merge(localClock, remoteClock),
        lastModified: new Date().toISOString(),
      };
    } else {
      // Remote dominates
      const remoteData = 'data' in (remoteEntity as object)
        ? (remoteEntity as SyncEntity<T>).data
        : remoteEntity as T;
      return {
        data: remoteData,
        vectorClock: VectorClockUtils.merge(localClock, remoteClock),
        lastModified: new Date().toISOString(),
      };
    }
  };

  // Merge all entities
  const mergedData: SyncData = {
    version: 3,
    deviceId,
    lastModified: new Date().toISOString(),
    vectorClock: VectorClockUtils.merge(local.vectorClock || {}, remote.vectorClock || {}),
    annotations: mergeEntity(local.annotations, remote.annotations, "annotation", "all"),
    bookmarks: mergeEntity(local.bookmarks, remote.bookmarks, "bookmark", "all"),
    bibtex: mergeEntity(local.bibtex, remote.bibtex, "bibtex", "all"),
    mindMaps: mergeEntity(local.mindMaps, remote.mindMaps, "mindmap", "all"),
    studyGroups: mergeEntity(local.studyGroups, remote.studyGroups, "study_group", "all"),
    settings: mergeEntity(local.settings, remote.settings, "settings", "all"),
    library: null,
  };

  return {
    data: mergedData,
    conflicts,
    hasConflicts: conflicts.length > 0,
  };
}

// Resolve a conflict with a chosen resolution
export function resolveConflict(conflict: ConflictItem, resolution: "local" | "remote"): unknown {
  if (resolution === "local") {
    return conflict.localData;
  }
  return conflict.remoteData;
}

// Apply conflict resolutions to sync data
export function applyConflictResolutions(
  data: SyncData,
  conflicts: ConflictItem[]
): SyncData {
  const result = { ...data };

  for (const conflict of conflicts) {
    if (!conflict.resolution || conflict.resolution === "skip") continue;

    const resolvedData = conflict.resolution === "local"
      ? conflict.localData
      : conflict.remoteData;

    switch (conflict.entityType) {
      case "annotation":
        result.annotations = {
          ...result.annotations,
          data: resolvedData as Record<string, unknown>,
        };
        break;
      case "bookmark":
        result.bookmarks = {
          ...result.bookmarks,
          data: resolvedData as Record<string, unknown>,
        };
        break;
      case "bibtex":
        result.bibtex = {
          ...result.bibtex,
          data: resolvedData as Record<string, unknown>,
        };
        break;
      case "mindmap":
        result.mindMaps = {
          ...result.mindMaps,
          data: resolvedData as Record<string, unknown>,
        };
        break;
      case "study_group":
        result.studyGroups = {
          ...result.studyGroups,
          data: resolvedData as Record<string, unknown>,
        };
        break;
      case "settings":
        result.settings = {
          ...result.settings,
          data: resolvedData as Record<string, unknown>,
        };
        break;
    }
  }

  // Increment clock after resolution
  result.vectorClock = incrementLocalClock();
  result.lastModified = new Date().toISOString();

  return result;
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

// Sync PDF files along with metadata
export async function syncPdfFiles(
  localPdfs: { path: string; studyGroupName: string | null }[],
  onProgress?: (message: string) => void
): Promise<PdfSyncResult> {
  return syncAllPdfs(localPdfs, onProgress);
}

// Re-export for convenience
export { syncAllPdfs, type PdfSyncResult, type DownloadedPdfInfo } from "./fileStorageService";
export { getDeviceInfo, setDeviceName } from "../types/sync";
