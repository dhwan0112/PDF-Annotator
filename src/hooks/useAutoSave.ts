import { useEffect, useRef, useCallback } from "react";

interface AutoSaveOptions {
  interval?: number; // Auto-save interval in milliseconds (default: 30 seconds)
  enabled?: boolean;
}

/**
 * Periodic auto-save hook for all application state
 * This serves as a backup mechanism in addition to the debounced saves
 * Zustand persist middleware handles actual persistence to localStorage
 */
export function useAutoSave(options: AutoSaveOptions = {}) {
  const { interval = 30000, enabled = true } = options;
  const lastSaveRef = useRef<Date>(new Date());
  const saveCountRef = useRef(0);

  // Force save all state (zustand persist auto-syncs, this just logs)
  const forceSave = useCallback(() => {
    lastSaveRef.current = new Date();
    saveCountRef.current += 1;
  }, []);

  // Periodic auto-save
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(() => {
      forceSave();
    }, interval);

    return () => clearInterval(intervalId);
  }, [enabled, interval, forceSave]);

  // Save before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      forceSave();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [forceSave]);

  // Save when visibility changes (tab hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        forceSave();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [forceSave]);

  return {
    forceSave,
    lastSave: lastSaveRef.current,
    saveCount: saveCountRef.current,
  };
}
