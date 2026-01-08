import { useEffect, useRef, useState, memo } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { TextLayer } from "pdfjs-dist";
import { AnnotationLayer, TextSelectionHandler } from "../AnnotationLayer";
import { usePdfStore } from "../../stores";

interface PdfPageProps {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
  isVisible: boolean;
}

// Margin area dimensions (in pixels, before scaling)
// Always enabled for direct pen drawing beside PDF
const MARGIN_WIDTH = 200; // Left and right margin for drawing

export const PdfPage = memo(function PdfPage({
  pdfDocument,
  pageNumber,
  scale,
  rotation,
  isVisible,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const linkLayerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const renderTaskRef = useRef<ReturnType<PDFPageProxy["render"]> | null>(null);
  const textLayerInstanceRef = useRef<TextLayer | null>(null);
  const { setCurrentPage } = usePdfStore();

  // Load page
  useEffect(() => {
    let cancelled = false;

    pdfDocument.getPage(pageNumber).then((loadedPage) => {
      if (!cancelled) {
        setPage(loadedPage);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pdfDocument, pageNumber]);

  // Update dimensions when page, scale, or rotation changes
  useEffect(() => {
    if (!page) return;
    const viewport = page.getViewport({ scale, rotation });
    setDimensions({ width: viewport.width, height: viewport.height });
  }, [page, scale, rotation]);

  // Render page
  useEffect(() => {
    if (!page || !canvasRef.current || !isVisible) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Cancel previous render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    const viewport = page.getViewport({ scale, rotation });
    const outputScale = window.devicePixelRatio || 1;

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const transform: [number, number, number, number, number, number] | undefined =
      outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

    const renderContext = {
      canvasContext: context,
      transform,
      viewport,
    };

    renderTaskRef.current = page.render(renderContext);
    renderTaskRef.current.promise.catch((err: Error) => {
      if (err.name !== "RenderingCancelledException") {
        console.error("Error rendering page:", err);
      }
    });

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [page, scale, rotation, isVisible]);

  // Render text layer
  useEffect(() => {
    if (!page || !textLayerRef.current || !isVisible) return;

    const textLayerDiv = textLayerRef.current;

    // Clear previous text layer
    if (textLayerInstanceRef.current) {
      textLayerInstanceRef.current.cancel();
      textLayerInstanceRef.current = null;
    }
    textLayerDiv.innerHTML = "";

    const viewport = page.getViewport({ scale, rotation });

    page.getTextContent().then((textContent) => {
      if (!textLayerRef.current) return;

      const textLayer = new TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
      });

      textLayerInstanceRef.current = textLayer;
      textLayer.render();
    });

    return () => {
      if (textLayerInstanceRef.current) {
        textLayerInstanceRef.current.cancel();
      }
    };
  }, [page, scale, rotation, isVisible]);

  // Render link/annotation layer (for PDF internal links)
  useEffect(() => {
    if (!page || !linkLayerRef.current || !isVisible) return;

    const linkLayerDiv = linkLayerRef.current;
    linkLayerDiv.innerHTML = "";

    const viewport = page.getViewport({ scale, rotation });

    page.getAnnotations().then(async (annotations) => {
      if (!linkLayerRef.current) return;

      // Filter to only link annotations
      const linkAnnotations = annotations.filter(
        (a) => a.subtype === "Link" && (a.url || a.dest)
      );

      if (linkAnnotations.length === 0) return;

      // Create link elements manually
      for (const annotation of linkAnnotations) {
        const rect = annotation.rect;
        if (!rect) continue;

        // Transform rect coordinates using viewport
        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        // Create section element
        const section = document.createElement("section");
        section.className = "linkAnnotation";
        section.style.cssText = `position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; pointer-events: auto;`;

        // Create link element with explicit styles for interactivity
        const link = document.createElement("a");
        link.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: block;
          cursor: pointer;
        `;

        // Add hover effect via event listeners
        link.addEventListener("mouseenter", () => {
          link.style.backgroundColor = "rgba(255, 255, 0, 0.3)";
        });
        link.addEventListener("mouseleave", () => {
          link.style.backgroundColor = "transparent";
        });

        if (annotation.url) {
          // External URL
          link.href = annotation.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.title = annotation.url;
        } else if (annotation.dest) {
          // Internal destination
          link.href = "#";
          link.title = "Go to page";
          link.onclick = async (e) => {
            e.preventDefault();
            try {
              let explicitDest: unknown[] | null = null;
              if (typeof annotation.dest === "string") {
                explicitDest = await pdfDocument.getDestination(annotation.dest);
              } else if (Array.isArray(annotation.dest)) {
                explicitDest = annotation.dest;
              }
              if (explicitDest && explicitDest[0]) {
                const ref = explicitDest[0] as { num: number; gen: number };
                const pageIndex = await pdfDocument.getPageIndex(ref);
                setCurrentPage(pageIndex + 1);
              }
            } catch (err) {
              console.error("Failed to navigate:", err);
            }
          };
        }

        section.appendChild(link);
        linkLayerDiv.appendChild(section);
      }

      // Also detect text-based URLs that aren't proper link annotations
      const textContent = await page.getTextContent();
      const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;

      // Track existing link rects to avoid duplicates
      const existingLinkRects = linkAnnotations.map(a => a.rect).filter(Boolean);

      for (const item of textContent.items) {
        const textItem = item as { str: string; transform: number[]; width: number; height: number };
        if (!textItem.str) continue;

        const matches = textItem.str.match(urlRegex);
        if (!matches) continue;

        for (const url of matches) {
          // Get position from transform matrix
          const [, , , scaleY, tx, ty] = textItem.transform;
          const fontHeight = Math.abs(scaleY);

          // Check if this URL is already covered by an annotation link
          const isAlreadyCovered = existingLinkRects.some(rect => {
            if (!rect) return false;
            const [rx1, ry1, rx2, ry2] = rect;
            return tx >= rx1 - 5 && tx <= rx2 + 5 && ty >= ry1 - 5 && ty <= ry2 + 5;
          });

          if (isAlreadyCovered) continue;

          // Calculate position in viewport coordinates
          const startX = tx * scale;
          const startY = (viewport.height / scale - ty) * scale - fontHeight * scale;
          const linkWidth = textItem.width * scale;
          const linkHeight = fontHeight * scale * 1.2;

          // Create clickable element for the URL
          const section = document.createElement("section");
          section.className = "textUrlLink";
          section.style.cssText = `position: absolute; left: ${startX}px; top: ${startY}px; width: ${linkWidth}px; height: ${linkHeight}px; pointer-events: auto;`;

          const link = document.createElement("a");
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.title = url;
          link.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: block;
            cursor: pointer;
          `;

          link.addEventListener("mouseenter", () => {
            link.style.backgroundColor = "rgba(255, 255, 0, 0.3)";
          });
          link.addEventListener("mouseleave", () => {
            link.style.backgroundColor = "transparent";
          });

          section.appendChild(link);
          linkLayerRef.current?.appendChild(section);
        }
      }
    });
  }, [page, pdfDocument, scale, rotation, isVisible, setCurrentPage]);

  // Calculate margin-extended dimensions (always enabled for pen drawing)
  const marginWidth = MARGIN_WIDTH * scale;
  const totalWidth = dimensions.width + marginWidth * 2;
  const totalHeight = dimensions.height;

  return (
    <div
      data-page-number={pageNumber}
      className="relative shadow-lg"
      style={{ width: totalWidth, height: totalHeight }}
    >
      {/* Left margin area (drawable) */}
      <div
        className="absolute top-0 left-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700"
        style={{ width: marginWidth, height: totalHeight }}
      />

      {/* PDF page area */}
      <div
        className="absolute bg-white"
        style={{
          left: marginWidth,
          top: 0,
          width: dimensions.width,
          height: dimensions.height,
        }}
      >
        {isVisible ? (
          <>
            {/* PDF Canvas */}
            <canvas ref={canvasRef} className="absolute top-0 left-0" />

            {/* Text Layer (for selection) */}
            <div
              ref={textLayerRef}
              className="absolute top-0 left-0 text-layer"
              style={{ width: dimensions.width, height: dimensions.height }}
            />

            {/* Link Layer (for PDF internal/external links) */}
            <div
              ref={linkLayerRef}
              className="absolute top-0 left-0"
              style={{
                width: dimensions.width,
                height: dimensions.height,
                zIndex: 10,
                pointerEvents: "none"
              }}
            />

            {/* Text Selection Handler for highlight/underline/strikeout */}
            <TextSelectionHandler
              pageNumber={pageNumber}
              scale={scale}
              containerRef={textLayerRef}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Right margin area (drawable) */}
      <div
        className="absolute top-0 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700"
        style={{
          left: marginWidth + dimensions.width,
          width: marginWidth,
          height: totalHeight,
        }}
      />

      {/* Full-width Annotation Layer (covers PDF + margins) */}
      {isVisible && (
        <AnnotationLayer
          pageNumber={pageNumber}
          width={totalWidth}
          height={totalHeight}
          scale={scale}
          marginOffset={marginWidth}
        />
      )}

      {/* Page number indicator */}
      <div
        className="absolute bottom-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10"
        style={{ right: marginWidth + 8 }}
      >
        {pageNumber}
      </div>
    </div>
  );
});
