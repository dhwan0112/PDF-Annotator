import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dropboxService, type DropboxSyncResult } from "../services/dropboxService";
import type { ConflictItem } from "../types/sync";

export type SyncProvider = "dropbox" | "github" | null;

interface SyncState {
  // Current provider
  provider: SyncProvider;

  // Connection status
  isConnected: boolean;

  // Sync status
  lastSync: string | null;
  syncInProgress: boolean;
  error: string | null;

  // Conflict handling
  pendingConflicts: ConflictItem[];
  showConflictDialog: boolean;

  // Auto sync settings
  autoSyncEnabled: boolean;
  autoSyncInterval: number; // minutes

  // Device info
  deviceName: string;

  // Actions
  setProvider: (provider: SyncProvider) => void;
  setConnected: (connected: boolean) => void;
  setLastSync: (time: string | null) => void;
  setSyncInProgress: (inProgress: boolean) => void;
  setError: (error: string | null) => void;
  setAutoSync: (enabled: boolean, interval?: number) => void;
  setDeviceName: (name: string) => void;

  // Conflict actions
  setPendingConflicts: (conflicts: ConflictItem[]) => void;
  setShowConflictDialog: (show: boolean) => void;
  resolveConflicts: (resolvedConflicts: ConflictItem[]) => Promise<void>;
  clearConflicts: () => void;

  // Dropbox actions
  connectDropbox: (appKey: string) => Promise<string>;
  handleDropboxCallback: (code: string) => Promise<void>;
  syncDropbox: () => Promise<DropboxSyncResult>;
  disconnectDropbox: () => void;

  // Check connection status
  checkConnection: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      provider: null,
      isConnected: false,
      lastSync: null,
      syncInProgress: false,
      error: null,
      pendingConflicts: [],
      showConflictDialog: false,
      autoSyncEnabled: false,
      autoSyncInterval: 15,
      deviceName: "",

      setProvider: (provider) => set({ provider }),
      setConnected: (connected) => set({ isConnected: connected }),
      setLastSync: (time) => set({ lastSync: time }),
      setSyncInProgress: (inProgress) => set({ syncInProgress: inProgress }),
      setError: (error) => set({ error }),

      setAutoSync: (enabled, interval) => set({
        autoSyncEnabled: enabled,
        autoSyncInterval: interval ?? get().autoSyncInterval,
      }),

      setDeviceName: (name) => {
        localStorage.setItem("marginalia-device-name", name);
        set({ deviceName: name });
      },

      setPendingConflicts: (conflicts) => set({ pendingConflicts: conflicts }),
      setShowConflictDialog: (show) => set({ showConflictDialog: show }),

      resolveConflicts: async (resolvedConflicts) => {
        try {
          set({ syncInProgress: true, error: null });

          // Apply resolutions and continue sync
          await dropboxService.applyConflictResolutions(resolvedConflicts);

          set({
            pendingConflicts: [],
            showConflictDialog: false,
            lastSync: new Date().toISOString(),
            syncInProgress: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to resolve conflicts";
          set({ error: message, syncInProgress: false });
        }
      },

      clearConflicts: () => set({
        pendingConflicts: [],
        showConflictDialog: false,
      }),

      connectDropbox: async (appKey) => {
        try {
          dropboxService.setAppKey(appKey);
          const authUrl = await dropboxService.getAuthUrl();
          set({ provider: "dropbox", error: null });
          return authUrl;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to start Dropbox auth";
          set({ error: message });
          throw error;
        }
      },

      handleDropboxCallback: async (code) => {
        try {
          set({ syncInProgress: true, error: null });
          await dropboxService.handleCallback(code);
          set({
            provider: "dropbox",
            isConnected: true,
            syncInProgress: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to complete Dropbox auth";
          set({ error: message, syncInProgress: false });
          throw error;
        }
      },

      syncDropbox: async () => {
        const state = get();
        if (state.syncInProgress) {
          return { success: false, error: "Sync already in progress" };
        }

        set({ syncInProgress: true, error: null });

        try {
          const result = await dropboxService.sync();

          if (result.success) {
            // Check for conflicts
            if (result.conflicts && result.conflicts.length > 0) {
              set({
                pendingConflicts: result.conflicts,
                showConflictDialog: true,
                syncInProgress: false,
              });
              return {
                success: false,
                error: `${result.conflicts.length} conflict(s) need resolution`,
                conflicts: result.conflicts,
              };
            }

            set({
              lastSync: result.lastSync || new Date().toISOString(),
              syncInProgress: false,
              error: null,
            });
          } else {
            set({
              error: result.error || "Sync failed",
              syncInProgress: false,
            });
          }

          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Sync failed";
          set({ error: message, syncInProgress: false });
          return { success: false, error: message };
        }
      },

      disconnectDropbox: () => {
        dropboxService.disconnect();
        set({
          provider: null,
          isConnected: false,
          lastSync: null,
          error: null,
          pendingConflicts: [],
          showConflictDialog: false,
        });
      },

      checkConnection: () => {
        const status = dropboxService.getStatus();
        set({ isConnected: status.connected });
        if (status.connected) {
          set({ provider: "dropbox" });
        }
      },
    }),
    {
      name: "marginalia-sync",
      partialize: (state) => ({
        provider: state.provider,
        lastSync: state.lastSync,
        autoSyncEnabled: state.autoSyncEnabled,
        autoSyncInterval: state.autoSyncInterval,
        deviceName: state.deviceName,
      }),
    }
  )
);

// Initialize connection status on load
if (typeof window !== "undefined") {
  setTimeout(() => {
    useSyncStore.getState().checkConnection();

    // Load device name
    const deviceName = localStorage.getItem("marginalia-device-name");
    if (deviceName) {
      useSyncStore.setState({ deviceName });
    }
  }, 100);
}
