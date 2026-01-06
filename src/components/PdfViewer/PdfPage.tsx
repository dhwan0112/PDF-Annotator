import { useEffect, useRef, useState, memo } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { TextLayer } from "pdfjs-dist";
import { AnnotationLayer, TextSelectionHandler } from "../AnnotationLayer";

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
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const renderTaskRef = useRef<ReturnType<PDFPageProxy["render"]> | null>(null);
  const textLayerInstanceRef = useRef<TextLayer | null>(null);

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
