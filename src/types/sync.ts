/**
 * Sync Types - Vector Clock based synchronization
 */

/** Vector Clock for conflict detection */
export type VectorClock = Record<string, number>;

/** Device identifier */
export interface DeviceInfo {
  id: string;
  name: string;
  platform: string;
  lastSeen: string;
}

/** Sync change log entry */
export interface SyncChangeLog {
  id: string;
  deviceId: string;
  timestamp: number;
  entityType: EntityType;
  entityId: string;
  operation: SyncOperation;
  payload: string;
  vectorClock: VectorClock;
}

export type EntityType =
  | "study_group"
  | "annotation"
  | "bookmark"
  | "mindmap"
  | "bibtex"
  | "settings";

export type SyncOperation = "create" | "update" | "delete";

/** Conflict item for resolution */
export interface ConflictItem {
  id: string;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  localVersion: SyncChangeLog;
  remoteVersion: SyncChangeLog;
  localData: unknown;
  remoteData: unknown;
  resolution?: ConflictResolution;
}

export type ConflictResolution = "local" | "remote" | "merge" | "skip";

/** Sync configuration */
export interface SyncConfig {
  provider: "dropbox" | "github" | "local";
  autoSync: boolean;
  syncIntervalMinutes: number;
  conflictResolution: "manual" | "local_wins" | "remote_wins" | "latest_wins";
}

/** Sync result */
export interface SyncResult {
  success: boolean;
  error?: string;
  lastSync?: string;
  conflicts?: ConflictItem[];
  changes?: {
    uploaded: number;
    downloaded: number;
    merged: number;
  };
}

/** Vector Clock utility functions */
export const VectorClockUtils = {
  /** Create a new vector clock */
  create(deviceId: string): VectorClock {
    return { [deviceId]: 1 };
  },

  /** Increment the clock for a device */
  increment(clock: VectorClock, deviceId: string): VectorClock {
    return {
      ...clock,
      [deviceId]: (clock[deviceId] || 0) + 1,
    };
  },

  /** Merge two vector clocks (take max of each component) */
  merge(a: VectorClock, b: VectorClock): VectorClock {
    const result: VectorClock = { ...a };
    for (const [device, count] of Object.entries(b)) {
      result[device] = Math.max(result[device] || 0, count);
    }
    return result;
  },

  /** Check if clock A dominates clock B (A >= B for all components) */
  dominates(a: VectorClock, b: VectorClock): boolean {
    for (const [device, countB] of Object.entries(b)) {
      if ((a[device] || 0) < countB) {
        return false;
      }
    }
    return true;
  },

  /** Check if two clocks are concurrent (neither dominates the other) */
  isConcurrent(a: VectorClock, b: VectorClock): boolean {
    return !VectorClockUtils.dominates(a, b) && !VectorClockUtils.dominates(b, a);
  },

  /** Compare two clocks: -1 if a < b, 0 if concurrent, 1 if a > b */
  compare(a: VectorClock, b: VectorClock): -1 | 0 | 1 {
    const aDominates = VectorClockUtils.dominates(a, b);
    const bDominates = VectorClockUtils.dominates(b, a);

    if (aDominates && !bDominates) return 1;
    if (bDominates && !aDominates) return -1;
    return 0; // Concurrent or equal
  },

  /** Get total count across all devices */
  getTotal(clock: VectorClock): number {
    return Object.values(clock).reduce((sum, count) => sum + count, 0);
  },
};

/** Generate a unique device ID */
export function generateDeviceId(): string {
  const stored = localStorage.getItem("marginalia-device-id");
  if (stored) return stored;

  const id = crypto.randomUUID();
  localStorage.setItem("marginalia-device-id", id);
  return id;
}

/** Get device info */
export function getDeviceInfo(): DeviceInfo {
  const id = generateDeviceId();
  const platform = navigator.platform || "unknown";
  const name = localStorage.getItem("marginalia-device-name") || `Device-${id.slice(0, 8)}`;

  return {
    id,
    name,
    platform,
    lastSeen: new Date().toISOString(),
  };
}

/** Set device name */
export function setDeviceName(name: string): void {
  localStorage.setItem("marginalia-device-name", name);
}
