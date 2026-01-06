import { useCallback } from "react";
import { useAnnotationStore } from "../../stores";
import type { NoteAnnotation } from "../../types";

interface NoteCreatorProps {
  pageNumber: number;
  scale: number;
  width: number;
  height: number;
  marginOffset?: number;
}

export function NoteCreator({ pageNumber, scale, width, height, marginOffset = 0 }: NoteCreatorProps) {
  const { currentTool, getCurrentColor, addAnnotation } = useAnnotationStore();
  const currentColor = getCurrentColor();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (currentTool !== "note") return;

      const rect = e.currentTarget.getBoundingClientRect();
      // Account for margin offset - coordinates relative to PDF origin
      const x = (e.clientX - rect.left - marginOffset) / scale;
      const y = (e.clientY - rect.top) / scale;

      const annotation: NoteAnnotation = {
        id: crypto.randomUUID(),
        type: "note",
        pageNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
        color: currentColor,
        position: { x, y },
        content: "",
      };

      addAnnotation(annotation);
    },
    [currentTool, currentColor, pageNumber, scale, marginOffset, addAnnotation]
  );

  if (currentTool !== "note") {
    return null;
  }

  return (
    <div
      className="absolute inset-0 cursor-crosshair pointer-events-auto"
      style={{ width, height, zIndex: 3 }}
      onClick={handleClick}
    />
  );
}
