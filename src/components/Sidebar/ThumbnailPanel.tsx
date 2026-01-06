import { useEffect, useRef, useState, memo } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { usePdfStore } from "../../stores";

interface ThumbnailPanelProps {
  pdfDocument: PDFDocumentProxy | null;
}

export function ThumbnailPanel({ pdfDocument }: ThumbnailPanelProps) {
  const { currentPage, setCurrentPage } = usePdfStore();

  if (!pdfDocument) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm">
        Page thumbnails will appear here when a PDF is loaded.
      </div>
    );
  }

  // Use pdfDocument.numPages directly to avoid sync issues with store
  const numPages = pdfDocument.numPages;

  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
        <ThumbnailItem
          key={`${pdfDocument.fingerprints[0]}-${pageNum}`}
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
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderingRef = useRef(false);

  // Render thumbnail - start immediately for first few pages, use IntersectionObserver for rest
  useEffect(() => {
    if (rendered || renderingRef.current || error) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // For first 5 pages, render immediately; otherwise use IntersectionObserver
    const shouldRenderImmediately = pageNumber <= 5;

    const doRender = async () => {
      if (renderingRef.current) return;
      renderingRef.current = true;

      try {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 0.2 });
        const context = canvas.getContext("2d");

        if (!context) {
          setError(true);
          return;
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        setRendered(true);
      } catch (err) {
        console.error("Error rendering thumbnail:", pageNumber, err);
        setError(true);
      } finally {
        renderingRef.current = false;
      }
    };

    if (shouldRenderImmediately) {
      doRender();
    } else {
      // Use IntersectionObserver for lazy loading
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            observer.disconnect();
            doRender();
          }
        },
        { threshold: 0.1, rootMargin: "100px" }
      );

      observer.observe(container);

      return () => {
        observer.disconnect();
      };
    }
  }, [pdfDocument, pageNumber, rendered, error]);

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
      <div className="relative bg-gray-200 dark:bg-gray-700 shadow-sm rounded overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-auto"
          style={{ aspectRatio: "8.5/11", display: rendered ? "block" : "none" }}
        />
        {!rendered && !error && (
          <div
            className="flex items-center justify-center bg-gray-100 dark:bg-gray-700"
            style={{ aspectRatio: "8.5/11" }}
          >
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div
            className="flex items-center justify-center bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-xs"
            style={{ aspectRatio: "8.5/11" }}
          >
            Failed
          </div>
        )}
      </div>
      <div className="text-center text-xs text-gray-600 dark:text-gray-400 mt-1">
        {pageNumber}
      </div>
    </div>
  );
});
