import { useEffect, useRef, useState, memo } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { usePdfStore } from "../../stores";

interface ThumbnailPanelProps {
  pdfDocument: PDFDocumentProxy | null;
}

export function ThumbnailPanel({ pdfDocument }: ThumbnailPanelProps) {
  const { currentPage, setCurrentPage, totalPages } = usePdfStore();

  if (!pdfDocument) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm">
        Page thumbnails will appear here when a PDF is loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
        <ThumbnailItem
          key={pageNum}
          pdfDocument={pdfDocument}
          pageNumber={pageNum}
          isActive={pageNum === currentPage}
          onClick={() => setCurrentPage(pageNum)}
        />
      ))}
    </div>
  );
}

interface ThumbnailItemProps {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
}

const ThumbnailItem = memo(function ThumbnailItem({
  pdfDocument,
  pageNumber,
  isActive,
  onClick,
}: ThumbnailItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy load thumbnails using Intersection Observer
  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !rendered) {
          renderThumbnail();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [rendered]);

  const renderThumbnail = async () => {
    if (!canvasRef.current || rendered) return;

    try {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.2 });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      setRendered(true);
    } catch (err) {
      console.error("Error rendering thumbnail:", err);
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`thumbnail-item p-2 rounded-lg border-2 transition-all ${
        isActive
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
          : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      <div className="relative bg-white shadow-sm rounded overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-auto"
          style={{ aspectRatio: "8.5/11" }}
        />
        {!rendered && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="text-center text-xs text-gray-600 dark:text-gray-400 mt-1">
        {pageNumber}
      </div>
    </div>
  );
});
