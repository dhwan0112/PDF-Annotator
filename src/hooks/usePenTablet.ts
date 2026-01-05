import { useEffect, useRef, useCallback } from "react";
import { useAnnotationStore } from "../stores";

/**
 * Hook to detect pen tablet input and automatically switch to drawing tool
 * When a pen stylus is detected, it switches to the last used drawing tool
 */
export function usePenTablet() {
  const { switchToPenTool } = useAnnotationStore();
  const lastPointerTypeRef = useRef<string>("mouse");

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      // Detect pen input
      if (e.pointerType === "pen" && lastPointerTypeRef.current !== "pen") {
        // Pen detected - switch to drawing tool
        switchToPenTool();
      }
      lastPointerTypeRef.current = e.pointerType;
    },
    [switchToPenTool]
  );

  const handlePointerMove = useCallback((e: PointerEvent) => {
    // Track pointer type changes even during move
    if (e.pointerType !== lastPointerTypeRef.current) {
      lastPointerTypeRef.current = e.pointerType;
    }
  }, []);

  useEffect(() => {
    // Listen for pointer events at document level
    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    document.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      document.removeEventListener("pointermove", handlePointerMove);
    };
  }, [handlePointerDown, handlePointerMove]);

  return {
    lastPointerType: lastPointerTypeRef.current,
  };
}
