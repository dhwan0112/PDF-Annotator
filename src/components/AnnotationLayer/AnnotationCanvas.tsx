import { useRef, useEffect, useCallback, useState } from "react";
import { getStroke } from "perfect-freehand";
import { useAnnotationStore } from "../../stores";
import type { InkAnnotation, HighlighterInkAnnotation, RectAnnotation, Point, Stroke, Rect } from "../../types";

interface AnnotationCanvasProps {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
  marginOffset?: number;
}

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

interface RectPreview {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function AnnotationCanvas({
  pageNumber,
  width,
  height,
  scale,
  marginOffset = 0,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentTool, getCurrentColor, getStrokeWidth, getHighlightOpacity, addAnnotation, getAnnotationsForPage } =
    useAnnotationStore();
  const currentColor = getCurrentColor();
  const strokeWidth = getStrokeWidth();
  const highlightOpacity = getHighlightOpacity();

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<StrokePoint[]>([]);
  const [rectPreview, setRectPreview] = useState<RectPreview | null>(null);

  // Get annotations for this page
  const annotations = getAnnotationsForPage(pageNumber);
  const inkAnnotations = annotations.filter(
    (a): a is InkAnnotation => a.type === "ink"
  );
  const highlighterInkAnnotations = annotations.filter(
    (a): a is HighlighterInkAnnotation => a.type === "highlighterInk"
  );
  const rectAnnotations = annotations.filter(
    (a): a is RectAnnotation => a.type === "rect"
  );

  // Convert screen coordinates to PDF coordinates
  const screenToPdf = useCallback(
    (x: number, y: number): Point => {
      return {
        x: (x - marginOffset) / scale,
        y: y / scale,
      };
    },
    [scale, marginOffset]
  );

  // Convert points to SVG path using perfect-freehand
  const getSvgPathFromStroke = (points: number[][]) => {
    if (points.length === 0) return "";

    const d: string[] = [];
    let p0 = points[0];
    d.push(`M ${p0[0].toFixed(2)} ${p0[1].toFixed(2)}`);

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i];
      const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      d.push(`Q ${p0[0].toFixed(2)} ${p0[1].toFixed(2)} ${mid[0].toFixed(2)} ${mid[1].toFixed(2)}`);
      p0 = p1;
    }

    return d.join(" ");
  };

  // Draw stroke on canvas
  const drawStroke = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      points: StrokePoint[],
      color: string,
      strokeW: number,
      opacity: number = 1
    ) => {
      if (points.length < 2) return;

      const strokePoints = getStroke(
        points.map((p) => [p.x * scale + marginOffset, p.y * scale, p.pressure]),
        {
          size: strokeW * scale,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.5,
        }
      );

      const path = new Path2D(getSvgPathFromStroke(strokePoints) + " Z");
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.fill(path);
      ctx.restore();
    },
    [scale, marginOffset]
  );

  // Draw rectangle on canvas
  const drawRect = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      rect: Rect,
      color: string,
      opacity: number = 0.3,
      strokeOnly: boolean = false
    ) => {
      const x = rect.x * scale + marginOffset;
      const y = rect.y * scale;
      const w = rect.width * scale;
      const h = rect.height * scale;

      ctx.save();
      ctx.globalAlpha = opacity;

      if (strokeOnly) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, w, h);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1;
        ctx.strokeRect(x, y, w, h);
      }

      ctx.restore();
    },
    [scale, marginOffset]
  );

  // Set up canvas with proper DPI scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, [width, height]);

  // Render all annotations
  const renderAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Draw existing rect annotations
    rectAnnotations.forEach((annotation) => {
      drawRect(ctx, annotation.rect, annotation.color, 0.3);
    });

    // Draw existing highlighter ink annotations (below regular ink)
    highlighterInkAnnotations.forEach((annotation) => {
      annotation.strokes.forEach((stroke) => {
        const points: StrokePoint[] = stroke.points.map((p, i) => ({
          x: p.x,
          y: p.y,
          pressure: stroke.pressure[i] ?? 0.5,
        }));
        drawStroke(ctx, points, stroke.color, stroke.width, annotation.opacity);
      });
    });

    // Draw existing ink annotations
    inkAnnotations.forEach((annotation) => {
      annotation.strokes.forEach((stroke) => {
        const points: StrokePoint[] = stroke.points.map((p, i) => ({
          x: p.x,
          y: p.y,
          pressure: stroke.pressure[i] ?? 0.5,
        }));
        drawStroke(ctx, points, stroke.color, stroke.width, 1);
      });
    });

    // Draw current stroke (pen or highlighter)
    if (currentStrokeRef.current.length > 0) {
      const opacity = currentTool === "highlighter" ? highlightOpacity : 1;
      drawStroke(ctx, currentStrokeRef.current, currentColor, strokeWidth, opacity);
    }

    // Draw rect preview
    if (rectPreview) {
      const rect: Rect = {
        x: Math.min(rectPreview.startX, rectPreview.endX),
        y: Math.min(rectPreview.startY, rectPreview.endY),
        width: Math.abs(rectPreview.endX - rectPreview.startX),
        height: Math.abs(rectPreview.endY - rectPreview.startY),
      };
      drawRect(ctx, rect, currentColor, 0.3, true);
    }
  }, [inkAnnotations, highlighterInkAnnotations, rectAnnotations, currentTool, currentColor, strokeWidth, highlightOpacity, drawStroke, drawRect, rectPreview]);

  // Re-render when annotations change
  useEffect(() => {
    renderAnnotations();
  }, [renderAnnotations]);

  // Handle pointer events
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const drawingTools = ["pen", "highlighter", "eraser", "rect"];
      if (!drawingTools.includes(currentTool)) return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const x = e.clientX - canvasRect.left;
      const y = e.clientY - canvasRect.top;
      const pdfPoint = screenToPdf(x, y);

      isDrawingRef.current = true;

      if (currentTool === "rect") {
        setRectPreview({
          startX: pdfPoint.x,
          startY: pdfPoint.y,
          endX: pdfPoint.x,
          endY: pdfPoint.y,
        });
      } else {
        const point: StrokePoint = {
          x: pdfPoint.x,
          y: pdfPoint.y,
          pressure: e.pressure || 0.5,
        };
        currentStrokeRef.current = [point];
      }
    },
    [currentTool, screenToPdf]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;

      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const x = e.clientX - canvasRect.left;
      const y = e.clientY - canvasRect.top;
      const pdfPoint = screenToPdf(x, y);

      if (currentTool === "rect") {
        setRectPreview((prev) =>
          prev ? { ...prev, endX: pdfPoint.x, endY: pdfPoint.y } : null
        );
      } else {
        const point: StrokePoint = {
          x: pdfPoint.x,
          y: pdfPoint.y,
          pressure: e.pressure || 0.5,
        };
        currentStrokeRef.current = [...currentStrokeRef.current, point];
        renderAnnotations();
      }
    },
    [currentTool, screenToPdf, renderAnnotations]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;

      e.currentTarget.releasePointerCapture(e.pointerId);
      isDrawingRef.current = false;

      if (currentTool === "rect" && rectPreview) {
        // Create rect annotation
        const rectData: Rect = {
          x: Math.min(rectPreview.startX, rectPreview.endX),
          y: Math.min(rectPreview.startY, rectPreview.endY),
          width: Math.abs(rectPreview.endX - rectPreview.startX),
          height: Math.abs(rectPreview.endY - rectPreview.startY),
        };

        if (rectData.width > 5 / scale && rectData.height > 5 / scale) {
          const annotation: RectAnnotation = {
            id: crypto.randomUUID(),
            type: "rect",
            pageNumber,
            createdAt: new Date(),
            updatedAt: new Date(),
            color: currentColor,
            rect: rectData,
          };
          addAnnotation(annotation);
        }
        setRectPreview(null);
      } else if (currentStrokeRef.current.length >= 2) {
        const stroke: Stroke = {
          points: currentStrokeRef.current.map((p) => ({ x: p.x, y: p.y })),
          pressure: currentStrokeRef.current.map((p) => p.pressure),
          color: currentColor,
          width: strokeWidth,
        };

        if (currentTool === "pen") {
          const annotation: InkAnnotation = {
            id: crypto.randomUUID(),
            type: "ink",
            pageNumber,
            createdAt: new Date(),
            updatedAt: new Date(),
            color: currentColor,
            strokes: [stroke],
          };
          addAnnotation(annotation);
        } else if (currentTool === "highlighter") {
          const annotation: HighlighterInkAnnotation = {
            id: crypto.randomUUID(),
            type: "highlighterInk",
            pageNumber,
            createdAt: new Date(),
            updatedAt: new Date(),
            color: currentColor,
            strokes: [stroke],
            opacity: highlightOpacity,
          };
          addAnnotation(annotation);
        }
      }

      currentStrokeRef.current = [];
      renderAnnotations();
    },
    [currentTool, currentColor, strokeWidth, highlightOpacity, pageNumber, addAnnotation, renderAnnotations, rectPreview, scale]
  );

  const handlePointerCancel = useCallback(() => {
    isDrawingRef.current = false;
    currentStrokeRef.current = [];
    setRectPreview(null);
    renderAnnotations();
  }, [renderAnnotations]);

  const isInteractive = ["pen", "highlighter", "eraser", "rect"].includes(currentTool);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 ${
        isInteractive ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
      }`}
      style={{ touchAction: "none", zIndex: 4, width, height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
    />
  );
}
