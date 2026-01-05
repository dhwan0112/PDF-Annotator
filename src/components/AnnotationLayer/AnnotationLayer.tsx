import { AnnotationCanvas } from "./AnnotationCanvas";
import { HighlightLayer } from "./HighlightLayer";
import { NoteLayer } from "./NoteLayer";
import { NoteCreator } from "./NoteCreator";

interface AnnotationLayerProps {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
  marginOffset?: number; // Offset from left edge where PDF content starts
}

export function AnnotationLayer({
  pageNumber,
  width,
  height,
  scale,
  marginOffset = 0,
}: AnnotationLayerProps) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width, height }}
    >
      {/* Highlight layer (below canvas) - offset by margin */}
      <div style={{ position: "absolute", left: marginOffset, top: 0 }}>
        <HighlightLayer pageNumber={pageNumber} scale={scale} />
      </div>

      {/* Note creator layer (for adding new notes) */}
      <NoteCreator
        pageNumber={pageNumber}
        scale={scale}
        width={width}
        height={height}
        marginOffset={marginOffset}
      />

      {/* Ink annotation canvas - covers full area including margins */}
      <AnnotationCanvas
        pageNumber={pageNumber}
        width={width}
        height={height}
        scale={scale}
        marginOffset={marginOffset}
      />

      {/* Note layer (above canvas) - offset by margin */}
      <div style={{ position: "absolute", left: marginOffset, top: 0, width: width - marginOffset * 2, height }}>
        <NoteLayer pageNumber={pageNumber} scale={scale} />
      </div>
    </div>
  );
}
