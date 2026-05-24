import { useEffect, useRef, useCallback } from "react";
import { useSyncStore } from "../stores/syncStore";

/**
 * Hook for automatic periodic synchronization
 * Uses autoSyncEnabled and autoSyncInterval settings from syncStore
 */
export function useAutoSync() {
  const {
    autoSyncEnabled,
    autoSyncInterval,
    isConnected,
    syncInProgress,
    syncDropbox,
    setError,
  } = useSyncStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncAttemptRef = useRef<number>(0);

  const performSync = useCallback(async () => {
    if (!isConnected || syncInProgress) {
      return;
    }

    const now = Date.now();
    if (now - lastSyncAttemptRef.current < 30000) {
      return;
    }

    lastSyncAttemptRef.current = now;

    try {
      await syncDropbox();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Auto-sync failed";
      setError(message);
    }
  }, [isConnected, syncInProgress, syncDropbox, setError]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (autoSyncEnabled && isConnected) {
      const intervalMs = autoSyncInterval * 60 * 1000;

      const initialTimeout = setTimeout(() => {
        performSync();
      }, 5000);

      intervalRef.current = setInterval(() => {
        performSync();
      }, intervalMs);

      return () => {
        clearTimeout(initialTimeout);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [autoSyncEnabled, autoSyncInterval, isConnected, performSync]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && autoSyncEnabled && isConnected) {
        setTimeout(() => {
          performSync();
        }, 1000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoSyncEnabled, isConnected, performSync]);

  useEffect(() => {
    const handleOnline = () => {
      if (autoSyncEnabled && isConnected) {
        setTimeout(() => {
          performSync();
        }, 2000);
      }
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [autoSyncEnabled, isConnected, performSync]);

  return {
    performSync,
    isAutoSyncEnabled: autoSyncEnabled,
    syncInterval: autoSyncInterval,
  };
}
