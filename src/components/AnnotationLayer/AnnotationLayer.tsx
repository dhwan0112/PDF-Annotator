import { AnnotationCanvas } from "./AnnotationCanvas";
import { HighlightLayer } from "./HighlightLayer";
import { NoteLayer } from "./NoteLayer";
import { NoteCreator } from "./NoteCreator";

interface AnnotationLayerProps {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
}

export function AnnotationLayer({
  pageNumber,
  width,
  height,
  scale,
}: AnnotationLayerProps) {
  return (
    <div
      className="absolute inset-0"
      style={{ width, height }}
    >
      {/* Highlight layer (below canvas) */}
      <HighlightLayer pageNumber={pageNumber} scale={scale} />

      {/* Note creator layer (for adding new notes) */}
      <NoteCreator
        pageNumber={pageNumber}
        scale={scale}
        width={width}
        height={height}
      />

      {/* Ink annotation canvas */}
      <AnnotationCanvas
        pageNumber={pageNumber}
        width={width}
        height={height}
        scale={scale}
      />

      {/* Note layer (above canvas) */}
      <NoteLayer pageNumber={pageNumber} scale={scale} />
    </div>
  );
}
