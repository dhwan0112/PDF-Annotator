import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Annotation, InkAnnotation, HighlighterInkAnnotation, HighlightAnnotation, NoteAnnotation, RectAnnotation, TextBoxAnnotation } from "../types";

/**
 * Convert hex color to RGB values (0-1 range)
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

/**
 * Export annotations to a new PDF file
 * @param pdfBytes - Original PDF file as ArrayBuffer
 * @param annotations - Annotations to embed
 * @param _pageHeights - Map of page number to page height (unused - we get actual heights from PDF)
 * @returns Modified PDF as Uint8Array
 */
export async function exportAnnotationsToPdf(
  pdfBytes: ArrayBuffer,
  annotations: Annotation[],
  _pageHeights: Map<number, number>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Group annotations by page
  const annotationsByPage = new Map<number, Annotation[]>();
  for (const annotation of annotations) {
    const pageAnnotations = annotationsByPage.get(annotation.pageNumber) || [];
    pageAnnotations.push(annotation);
    annotationsByPage.set(annotation.pageNumber, pageAnnotations);
  }

  // Process each page
  for (const [pageNumber, pageAnnotations] of annotationsByPage) {
    const pageIndex = pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { height: pageHeight } = page.getSize();

    for (const annotation of pageAnnotations) {
      await drawAnnotation(page, annotation, pageHeight, font);
    }
  }

  return await pdfDoc.save();
}

/**
 * Draw a single annotation on a PDF page
 */
async function drawAnnotation(
  page: ReturnType<typeof PDFDocument.prototype.getPages>[0],
  annotation: Annotation,
  pageHeight: number,
  font: Awaited<ReturnType<typeof PDFDocument.prototype.embedFont>>
): Promise<void> {
  const { r, g, b } = hexToRgb(annotation.color);

  switch (annotation.type) {
    case "ink":
    case "highlighterInk": {
      const inkAnnotation = annotation as InkAnnotation | HighlighterInkAnnotation;
      const opacity = annotation.type === "highlighterInk"
        ? (annotation as HighlighterInkAnnotation).opacity
        : 1;

      for (const stroke of inkAnnotation.strokes) {
        if (stroke.points.length < 2) continue;

        // Draw line segments
        for (let i = 1; i < stroke.points.length; i++) {
          const p1 = stroke.points[i - 1];
          const p2 = stroke.points[i];

          page.drawLine({
            start: { x: p1.x, y: pageHeight - p1.y },
            end: { x: p2.x, y: pageHeight - p2.y },
            thickness: stroke.width,
            color: rgb(r, g, b),
            opacity,
          });
        }
      }
      break;
    }

    case "highlight": {
      const highlightAnnotation = annotation as HighlightAnnotation;
      for (const rect of highlightAnnotation.rects) {
        page.drawRectangle({
          x: rect.x,
          y: pageHeight - rect.y - rect.height,
          width: rect.width,
          height: rect.height,
          color: rgb(r, g, b),
          opacity: 0.3,
        });
      }
      break;
    }

    case "note": {
      const noteAnnotation = annotation as NoteAnnotation;
      // Draw note icon
      const iconSize = 20;
      page.drawRectangle({
        x: noteAnnotation.position.x,
        y: pageHeight - noteAnnotation.position.y - iconSize,
        width: iconSize,
        height: iconSize,
        color: rgb(r, g, b),
        opacity: 0.8,
      });
      // Draw note content as popup comment (simplified - just draw text nearby)
      if (noteAnnotation.content) {
        page.drawText(noteAnnotation.content.substring(0, 50), {
          x: noteAnnotation.position.x + iconSize + 5,
          y: pageHeight - noteAnnotation.position.y - 12,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      }
      break;
    }

    case "rect": {
      const rectAnnotation = annotation as RectAnnotation;
      page.drawRectangle({
        x: rectAnnotation.rect.x,
        y: pageHeight - rectAnnotation.rect.y - rectAnnotation.rect.height,
        width: rectAnnotation.rect.width,
        height: rectAnnotation.rect.height,
        borderColor: rgb(r, g, b),
        borderWidth: 2,
      });
      break;
    }

    case "textbox": {
      const textboxAnnotation = annotation as TextBoxAnnotation;
      const fontSize = textboxAnnotation.style.fontSize || 14;

      // Draw background if specified
      if (textboxAnnotation.backgroundColor) {
        const bgColor = hexToRgb(textboxAnnotation.backgroundColor);
        page.drawRectangle({
          x: textboxAnnotation.position.x,
          y: pageHeight - textboxAnnotation.position.y - textboxAnnotation.height,
          width: textboxAnnotation.width,
          height: textboxAnnotation.height,
          color: rgb(bgColor.r, bgColor.g, bgColor.b),
          opacity: 0.8,
        });
      }

      // Draw text
      const textColor = hexToRgb(textboxAnnotation.style.fontColor);
      page.drawText(textboxAnnotation.content, {
        x: textboxAnnotation.position.x + 5,
        y: pageHeight - textboxAnnotation.position.y - fontSize - 5,
        size: fontSize,
        font,
        color: rgb(textColor.r, textColor.g, textColor.b),
      });
      break;
    }
  }
}

