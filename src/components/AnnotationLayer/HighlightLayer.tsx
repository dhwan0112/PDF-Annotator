import { useAnnotationStore } from "../../stores";
import type { HighlightAnnotation, UnderlineAnnotation, StrikeoutAnnotation } from "../../types";

interface HighlightLayerProps {
  pageNumber: number;
  scale: number;
}

export function HighlightLayer({ pageNumber, scale }: HighlightLayerProps) {
  const { getAnnotationsForPage, selectAnnotation, selectedAnnotationId } =
    useAnnotationStore();

  const annotations = getAnnotationsForPage(pageNumber);
  const textAnnotations = annotations.filter(
    (a): a is HighlightAnnotation | UnderlineAnnotation | StrikeoutAnnotation =>
      a.type === "highlight" || a.type === "underline" || a.type === "strikeout"
  );

  if (textAnnotations.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {textAnnotations.map((annotation) => (
        <div key={annotation.id}>
          {annotation.rects.map((rect, index) => {
            const isSelected = selectedAnnotationId === annotation.id;
            const style = {
              left: rect.x * scale,
              top: rect.y * scale,
              width: rect.width * scale,
              height: rect.height * scale,
              backgroundColor:
                annotation.type === "highlight" ? annotation.color : "transparent",
              opacity: annotation.type === "highlight" ? 0.4 : 1,
            };

            if (annotation.type === "underline") {
              return (
                <div
                  key={index}
                  className="absolute pointer-events-auto cursor-pointer"
                  style={{
                    ...style,
                    height: 2 * scale,
                    top: (rect.y + rect.height) * scale - 2 * scale,
                    backgroundColor: annotation.color,
                  }}
                  onClick={() => selectAnnotation(annotation.id)}
                />
              );
            }

            if (annotation.type === "strikeout") {
              return (
                <div
                  key={index}
                  className="absolute pointer-events-auto cursor-pointer"
                  style={{
                    ...style,
                    height: 2 * scale,
                    top: (rect.y + rect.height / 2) * scale,
                    backgroundColor: annotation.color,
                  }}
                  onClick={() => selectAnnotation(annotation.id)}
                />
              );
            }

            return (
              <div
                key={index}
                className={`absolute annotation-highlight pointer-events-auto cursor-pointer ${
                  isSelected ? "ring-2 ring-blue-500" : ""
                }`}
                style={style}
                onClick={() => selectAnnotation(annotation.id)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
