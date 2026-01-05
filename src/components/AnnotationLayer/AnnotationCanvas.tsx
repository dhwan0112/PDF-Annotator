import { useRef, useEffect, useCallback } from "react";
import { getStroke } from "perfect-freehand";
import { useAnnotationStore } from "../../stores";
import type { InkAnnotation, Point, Stroke } from "../../types";

interface AnnotationCanvasProps {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
}

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export function AnnotationCanvas({
  pageNumber,
  width,
  height,
  scale,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentTool, getCurrentColor, getStrokeWidth, addAnnotation, getAnnotationsForPage } =
    useAnnotationStore();
  const currentColor = getCurrentColor();
  const strokeWidth = getStrokeWidth();

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<StrokePoint[]>([]);

  // Get annotations for this page
  const annotations = getAnnotationsForPage(pageNumber);
  const inkAnnotations = annotations.filter(
    (a): a is InkAnnotation => a.type === "ink"
  );

  // Convert screen coordinates to PDF coordinates
  const screenToPdf = useCallback(
    (x: number, y: number): Point => {
      return {
        x: x / scale,
        y: y / scale,
      };
    },
    [scale]
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
      strokeW: number
    ) => {
      if (points.length < 2) return;

      const strokePoints = getStroke(
        points.map((p) => [p.x * scale, p.y * scale, p.pressure]),
        {
          size: strokeW * scale,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.5,
        }
      );

      const path = new Path2D(getSvgPathFromStroke(strokePoints) + " Z");
      ctx.fillStyle = color;
      ctx.fill(path);
    },
    [scale]
  );

  // Render all annotations
  const renderAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing ink annotations
    inkAnnotations.forEach((annotation) => {
      annotation.strokes.forEach((stroke) => {
        const points: StrokePoint[] = stroke.points.map((p, i) => ({
          x: p.x,
          y: p.y,
          pressure: stroke.pressure[i] ?? 0.5,
        }));
        drawStroke(ctx, points, stroke.color, stroke.width);
      });
    });

    // Draw current stroke
    if (currentStrokeRef.current.length > 0) {
      drawStroke(ctx, currentStrokeRef.current, currentColor, strokeWidth);
    }
  }, [inkAnnotations, currentColor, strokeWidth, drawStroke]);

  // Re-render when annotations change
  useEffect(() => {
    renderAnnotations();
  }, [renderAnnotations]);

  // Handle pointer events
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (currentTool !== "pen" && currentTool !== "eraser") return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pdfPoint = screenToPdf(x, y);

      const point: StrokePoint = {
        x: pdfPoint.x,
        y: pdfPoint.y,
        pressure: e.pressure || 0.5,
      };

      isDrawingRef.current = true;
      currentStrokeRef.current = [point];
    },
    [currentTool, screenToPdf]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pdfPoint = screenToPdf(x, y);

      const point: StrokePoint = {
        x: pdfPoint.x,
        y: pdfPoint.y,
        pressure: e.pressure || 0.5,
      };

      currentStrokeRef.current = [...currentStrokeRef.current, point];
      renderAnnotations();
    },
    [screenToPdf, renderAnnotations]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;

      e.currentTarget.releasePointerCapture(e.pointerId);
      isDrawingRef.current = false;

      if (currentStrokeRef.current.length < 2) {
        currentStrokeRef.current = [];
        return;
      }

      if (currentTool === "pen") {
        // Create new ink annotation
        const stroke: Stroke = {
          points: currentStrokeRef.current.map((p) => ({ x: p.x, y: p.y })),
          pressure: currentStrokeRef.current.map((p) => p.pressure),
          color: currentColor,
          width: strokeWidth,
        };

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
      }

      currentStrokeRef.current = [];
      renderAnnotations();
    },
    [currentTool, currentColor, strokeWidth, pageNumber, addAnnotation, renderAnnotations]
  );

  const handlePointerCancel = useCallback(() => {
    isDrawingRef.current = false;
    currentStrokeRef.current = [];
    renderAnnotations();
  }, [renderAnnotations]);

  const isInteractive = currentTool === "pen" || currentTool === "eraser";

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`absolute top-0 left-0 ${
        isInteractive ? "cursor-crosshair" : "pointer-events-none"
      }`}
      style={{ touchAction: "none", zIndex: 4 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
    />
  );
}
