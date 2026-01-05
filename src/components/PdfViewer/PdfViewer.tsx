import { useEffect, useRef, useState, useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { usePdfStore } from "../../stores";
import { FileText, Loader2 } from "lucide-react";
import { PdfPage } from "./PdfPage";

interface PdfViewerProps {
  pdfDocument: PDFDocumentProxy | null;
}

export function PdfViewer({ pdfDocument }: PdfViewerProps) {
  const { filePath, zoomLevel, rotation, viewMode, currentPage, setCurrentPage, totalPages, setZoomLevel } =
    usePdfStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [visiblePages, setVisiblePages] = useState<number[]>([1]);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle Ctrl+Scroll zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      // Calculate zoom factor based on scroll direction
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.25, Math.min(4.0, zoomLevel + delta));
      setZoomLevel(newZoom);
    }
  }, [zoomLevel, setZoomLevel]);

  // Set up wheel listener for Ctrl+Scroll zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use passive: false to allow preventDefault
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  // Handle scroll to update current page and visible pages
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !pdfDocument || viewMode !== "continuous") return;

    // Debounce scroll handling
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      const containerHeight = container.clientHeight;

      // Find visible pages
      const pageElements = container.querySelectorAll("[data-page-number]");
      const visible: number[] = [];
      let currentPageNum = 1;
      let minDistance = Infinity;

      pageElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;
        const relativeBottom = rect.bottom - containerRect.top;

        // Check if page is visible
        if (relativeBottom > 0 && relativeTop < containerHeight) {
          const pageNum = parseInt(el.getAttribute("data-page-number") || "1");
          visible.push(pageNum);

          // Find the page closest to the top
          const distance = Math.abs(relativeTop);
          if (distance < minDistance) {
            minDistance = distance;
            currentPageNum = pageNum;
          }
        }
      });

      if (visible.length > 0) {
        setVisiblePages(visible);
        setCurrentPage(currentPageNum);
      }
    }, 100);
  }, [pdfDocument, viewMode, setCurrentPage]);

  // Scroll to page when currentPage changes (single page mode or navigation)
  useEffect(() => {
    if (!containerRef.current || !pdfDocument) return;

    if (viewMode === "single") {
      setVisiblePages([currentPage]);
    }
  }, [currentPage, viewMode, pdfDocument]);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll]);

  if (!filePath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        <FileText className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg mb-2">No PDF loaded</p>
        <p className="text-sm">Click "Open" or press Ctrl+O to open a PDF file</p>
      </div>
    );
  }

  if (!pdfDocument) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-12 h-12 mb-4 animate-spin" />
        <p className="text-lg">Loading PDF...</p>
      </div>
    );
  }

  const pagesToRender =
    viewMode === "continuous"
      ? Array.from({ length: totalPages }, (_, i) => i + 1)
      : [currentPage];

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-800"
    >
      <div className="flex flex-col items-center py-4 gap-4">
        {pagesToRender.map((pageNum) => (
          <PdfPage
            key={pageNum}
            pdfDocument={pdfDocument}
            pageNumber={pageNum}
            scale={zoomLevel}
            rotation={rotation}
            isVisible={visiblePages.includes(pageNum) || Math.abs(pageNum - currentPage) <= 2}
          />
        ))}
      </div>
    </div>
  );
}
