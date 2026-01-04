import { useEffect, useCallback, useRef } from "react";
import { useAnnotationStore } from "../../stores";
import type { HighlightAnnotation, UnderlineAnnotation, StrikeoutAnnotation, Rect } from "../../types";

interface TextSelectionHandlerProps {
  pageNumber: number;
  scale: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function TextSelectionHandler({
  pageNumber,
  scale,
  containerRef,
}: TextSelectionHandlerProps) {
  const { currentTool, currentColor, addAnnotation } = useAnnotationStore();
  const isProcessingRef = useRef(false);

  const getRectsFromSelection = useCallback(
    (selection: Selection, container: HTMLElement): Rect[] => {
      const range = selection.getRangeAt(0);
      const rects = range.getClientRects();
      const containerRect = container.getBoundingClientRect();

      const result: Rect[] = [];
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        // Convert to PDF coordinates (unscaled)
        result.push({
          x: (rect.left - containerRect.left) / scale,
          y: (rect.top - containerRect.top) / scale,
          width: rect.width / scale,
          height: rect.height / scale,
        });
      }

      return result;
    },
    [scale]
  );

  const handleMouseUp = useCallback(() => {
    if (isProcessingRef.current) return;

    const isTextMarkupTool =
      currentTool === "highlighter" ||
      currentTool === "underline" ||
      currentTool === "strikeout";

    if (!isTextMarkupTool) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) return;

    // Check if selection is within our container
    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) return;

    const text = selection.toString().trim();
    if (!text) return;

    isProcessingRef.current = true;

    const rects = getRectsFromSelection(selection, containerRef.current);
    if (rects.length === 0) {
      isProcessingRef.current = false;
      return;
    }

    const baseAnnotation = {
      id: crypto.randomUUID(),
      pageNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
      color: currentColor,
      rects,
      text,
    };

    if (currentTool === "highlighter") {
      const annotation: HighlightAnnotation = {
        ...baseAnnotation,
        type: "highlight",
      };
      addAnnotation(annotation);
    } else if (currentTool === "underline") {
      const annotation: UnderlineAnnotation = {
        ...baseAnnotation,
        type: "underline",
      };
      addAnnotation(annotation);
    } else if (currentTool === "strikeout") {
      const annotation: StrikeoutAnnotation = {
        ...baseAnnotation,
        type: "strikeout",
      };
      addAnnotation(annotation);
    }

    // Clear selection after creating annotation
    selection.removeAllRanges();

    // Reset processing flag after a short delay
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 100);
  }, [currentTool, currentColor, pageNumber, containerRef, getRectsFromSelection, addAnnotation]);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseUp]);

  return null;
}
