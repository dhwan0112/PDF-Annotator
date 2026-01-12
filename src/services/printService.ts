/**
 * Print Service - Print PDF with annotations
 *
 * Renders PDF pages with annotations overlaid for printing
 */

import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Annotation, Point } from "../types";

interface PrintOptions {
  pdfDocument: PDFDocumentProxy;
  annotations: Map<number, Annotation[]>;
  pageRange?: { start: number; end: number };
  scale?: number;
}

// Render a single annotation to canvas
function renderAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation,
  scale: number
) {
  ctx.save();

  switch (annotation.type) {
    case "ink":
      renderInkAnnotation(ctx, annotation, scale);
      break;
    case "highlighterInk":
      renderHighlighterInkAnnotation(ctx, annotation, scale);
      break;
    case "highlight":
      renderHighlightAnnotation(ctx, annotation, scale);
      break;
    case "underline":
      renderUnderlineAnnotation(ctx, annotation, scale);
      break;
    case "strikeout":
      renderStrikeoutAnnotation(ctx, annotation, scale);
      break;
    case "note":
      renderNoteAnnotation(ctx, annotation, scale);
      break;
    case "rect":
      renderRectAnnotation(ctx, annotation, scale);
      break;
    case "arrow":
      renderArrowAnnotation(ctx, annotation, scale);
      break;
    case "textbox":
      renderTextBoxAnnotation(ctx, annotation, scale);
      break;
  }

  ctx.restore();
}

// Render ink strokes
function renderInkAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: { strokes: Array<{ points: Point[]; color: string; width: number; pressure: number[] }> },
  scale: number
) {
  for (const stroke of annotation.strokes) {
    if (stroke.points.length < 2) continue;

    ctx.strokeStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw with pressure sensitivity
    for (let i = 1; i < stroke.points.length; i++) {
      const p0 = stroke.points[i - 1];
      const p1 = stroke.points[i];
      const pressure = stroke.pressure[i] ?? 0.5;

      ctx.lineWidth = stroke.width * pressure * scale;
      ctx.beginPath();
      ctx.moveTo(p0.x * scale, p0.y * scale);
      ctx.lineTo(p1.x * scale, p1.y * scale);
      ctx.stroke();
    }
  }
}

// Render highlighter ink
function renderHighlighterInkAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: { strokes: Array<{ points: Point[]; color: string; width: number; pressure: number[] }>; opacity: number },
  scale: number
) {
  ctx.globalAlpha = annotation.opacity;
  ctx.globalCompositeOperation = "multiply";
  renderInkAnnotation(ctx, annotation, scale);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

// Render text highlight
function renderHighlightAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: { rects: Array<{ x: number; y: number; width: number; height: number }>; color: string },
  scale: number
) {
  ctx.fillStyle = annotation.color;
  ctx.globalAlpha = 0.4;
  ctx.globalCompositeOperation = "multiply";

  for (const rect of annotation.rects) {
    ctx.fillRect(
      rect.x * scale,
      rect.y * scale,
      rect.width * scale,
      rect.height * scale
    );
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

// Render underline
function renderUnderlineAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: { rects: Array<{ x: number; y: number; width: number; height: number }>; color: string },
  scale: number
) {
  ctx.strokeStyle = annotation.color;
  ctx.lineWidth = 1 * scale;

  for (const rect of annotation.rects) {
    const y = (rect.y + rect.height) * scale;
    ctx.beginPath();
    ctx.moveTo(rect.x * scale, y);
    ctx.lineTo((rect.x + rect.width) * scale, y);
    ctx.stroke();
  }
}

// Render strikeout
function renderStrikeoutAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: { rects: Array<{ x: number; y: number; width: number; height: number }>; color: string },
  scale: number
) {
  ctx.strokeStyle = annotation.color;
  ctx.lineWidth = 1 * scale;

  for (const rect of annotation.rects) {
    const y = (rect.y + rect.height / 2) * scale;
    ctx.beginPath();
    ctx.moveTo(rect.x * scale, y);
    ctx.lineTo((rect.x + rect.width) * scale, y);
    ctx.stroke();
  }
}

// Render note marker
function renderNoteAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: { position: Point; color: string; content: string },
  scale: number
) {
  const x = annotation.position.x * scale;
  const y = annotation.position.y * scale;
  const size = 20 * scale;

  // Draw note icon
  ctx.fillStyle = annotation.color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size, y + size * 0.7);
  ctx.lineTo(x + size * 0.7, y + size);
  ctx.lineTo(x, y + size);
  ctx.closePath();
  ctx.fill();

  // Draw fold
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.moveTo(x + size * 0.7, y + size);
  ctx.lineTo(x + size * 0.7, y + size * 0.7);
  ctx.lineTo(x + size, y + size * 0.7);
  ctx.closePath();
  ctx.fill();
}

// Render rectangle
function renderRectAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: { rect: { x: number; y: number; width: number; height: number }; color: string },
  scale: number
) {
  ctx.strokeStyle = annotation.color;
  ctx.lineWidth = 2 * scale;
  ctx.strokeRect(
    annotation.rect.x * scale,
    annotation.rect.y * scale,
    annotation.rect.width * scale,
    annotation.rect.height * scale
  );
}

// Render arrow
function renderArrowAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: {
    start: Point;
    end: Point;
    color: string;
    strokeWidth: number;
    lineStyle: string;
    headStyle: string;
  },
  scale: number
) {
  const start = { x: annotation.start.x * scale, y: annotation.start.y * scale };
  const end = { x: annotation.end.x * scale, y: annotation.end.y * scale };

  ctx.strokeStyle = annotation.color;
  ctx.fillStyle = annotation.color;
  ctx.lineWidth = annotation.strokeWidth * scale;

  // Set line style
  if (annotation.lineStyle === "dashed") {
    ctx.setLineDash([8 * scale, 4 * scale]);
  } else if (annotation.lineStyle === "dotted") {
    ctx.setLineDash([2 * scale, 2 * scale]);
  }

  // Draw line
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw arrowhead
  if (annotation.headStyle === "arrow") {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headSize = 10 * scale;

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headSize * Math.cos(angle - Math.PI / 6),
      end.y - headSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      end.x - headSize * Math.cos(angle + Math.PI / 6),
      end.y - headSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }
}

// Render textbox
function renderTextBoxAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: {
    position: Point;
    width: number;
    height: number;
    content: string;
    style: {
      fontFamily: string;
      fontSize: number;
      fontColor: string;
      bold: boolean;
      italic: boolean;
    };
    backgroundColor?: string;
    borderColor?: string;
  },
  scale: number
) {
  const x = annotation.position.x * scale;
  const y = annotation.position.y * scale;
  const width = annotation.width * scale;
  const height = annotation.height * scale;

  // Background
  if (annotation.backgroundColor) {
    ctx.fillStyle = annotation.backgroundColor;
    ctx.fillRect(x, y, width, height);
  }

  // Border
  if (annotation.borderColor) {
    ctx.strokeStyle = annotation.borderColor;
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(x, y, width, height);
  }

  // Text
  const style = annotation.style;
  let fontStyle = "";
  if (style.bold) fontStyle += "bold ";
  if (style.italic) fontStyle += "italic ";

  ctx.font = `${fontStyle}${style.fontSize * scale}px ${style.fontFamily}`;
  ctx.fillStyle = style.fontColor;
  ctx.textBaseline = "top";

  // Simple text wrapping
  const words = annotation.content.split(" ");
  let line = "";
  let lineY = y + 4 * scale;
  const maxWidth = width - 8 * scale;
  const lineHeight = style.fontSize * scale * 1.2;

  for (const word of words) {
    const testLine = line + word + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== "") {
      ctx.fillText(line, x + 4 * scale, lineY);
      line = word + " ";
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x + 4 * scale, lineY);
}

// Main print function
export async function printWithAnnotations(options: PrintOptions): Promise<void> {
  const { pdfDocument, annotations, pageRange, scale = 1.5 } = options;

  const totalPages = pdfDocument.numPages;
  const startPage = pageRange?.start ?? 1;
  const endPage = pageRange?.end ?? totalPages;

  // Create print container
  const printContainer = document.createElement("div");
  printContainer.id = "print-container";
  printContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 999999;
    background: white;
    overflow: auto;
    display: none;
  `;

  // Create canvases for each page
  const canvases: HTMLCanvasElement[] = [];

  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.cssText = `
      display: block;
      margin: 0 auto 20px;
      page-break-after: always;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;

    const ctx = canvas.getContext("2d")!;

    // Render PDF page
    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    // Render annotations
    const pageAnnotations = annotations.get(pageNum) || [];
    for (const annotation of pageAnnotations) {
      renderAnnotation(ctx, annotation, scale);
    }

    canvases.push(canvas);
    printContainer.appendChild(canvas);
  }

  document.body.appendChild(printContainer);

  // Create print styles
  const printStyles = document.createElement("style");
  printStyles.id = "print-styles";
  printStyles.textContent = `
    @media print {
      body > *:not(#print-container) {
        display: none !important;
      }
      #print-container {
        display: block !important;
        position: static !important;
        background: none !important;
      }
      #print-container canvas {
        max-width: 100%;
        height: auto;
        box-shadow: none !important;
        margin: 0 !important;
        page-break-after: always;
      }
      #print-container canvas:last-child {
        page-break-after: auto;
      }
    }
  `;
  document.head.appendChild(printStyles);

  // Show print container and print
  printContainer.style.display = "block";

  // Use setTimeout to ensure rendering is complete
  setTimeout(() => {
    window.print();

    // Cleanup after print dialog closes
    const cleanup = () => {
      printContainer.remove();
      printStyles.remove();
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup);

    // Fallback cleanup after 5 seconds if afterprint doesn't fire
    setTimeout(() => {
      if (document.getElementById("print-container")) {
        cleanup();
      }
    }, 5000);
  }, 100);
}

// Print current page only
export async function printCurrentPage(
  pdfDocument: PDFDocumentProxy,
  annotations: Map<number, Annotation[]>,
  pageNumber: number
): Promise<void> {
  return printWithAnnotations({
    pdfDocument,
    annotations,
    pageRange: { start: pageNumber, end: pageNumber },
  });
}

// Export as images (alternative to printing)
export async function exportAsImages(
  pdfDocument: PDFDocumentProxy,
  annotations: Map<number, Annotation[]>,
  format: "png" | "jpeg" = "png",
  quality = 0.92
): Promise<Blob[]> {
  const totalPages = pdfDocument.numPages;
  const blobs: Blob[] = [];
  const scale = 2; // High resolution

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    // White background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render PDF
    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    // Render annotations
    const pageAnnotations = annotations.get(pageNum) || [];
    for (const annotation of pageAnnotations) {
      renderAnnotation(ctx, annotation, scale);
    }

    // Convert to blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b!),
        `image/${format}`,
        quality
      );
    });
    blobs.push(blob);
  }

  return blobs;
}
