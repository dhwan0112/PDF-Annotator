import { useEffect, useRef } from "react";
import { usePdfStore, useUiStore } from "../stores";

/**
 * Hook to restore the previous session on app startup
 * Automatically opens the last viewed PDF file and restores the view state
 */
export function useSessionRestore() {
  const { filePath, metadata } = usePdfStore();
  const { setCurrentView } = useUiStore();
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    // Only restore once on initial mount
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    // If there's a saved file path, switch to viewer mode
    if (filePath && metadata) {
      // Small delay to ensure the app is fully initialized
      const timer = setTimeout(() => {
        setCurrentView("viewer");
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [filePath, metadata, setCurrentView]);

  return {
    hasSession: !!filePath,
    sessionFilePath: filePath,
  };
}
