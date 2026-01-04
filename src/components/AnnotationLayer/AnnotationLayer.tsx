import { useAnnotationStore, usePdfStore } from "../../stores";

export function AnnotationLayer() {
  const { currentPage } = usePdfStore();
  const { getAnnotationsForPage } = useAnnotationStore();

  const annotations = getAnnotationsForPage(currentPage);

  if (annotations.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Annotation rendering will be implemented here */}
      {/* This layer overlays on top of the PDF canvas */}
    </div>
  );
}
