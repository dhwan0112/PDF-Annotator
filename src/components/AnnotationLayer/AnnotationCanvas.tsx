import { useRef, useEffect, useCallback, useState } from "react";
import { getStroke } from "perfect-freehand";
import { useAnnotationStore } from "../../stores";
import type { InkAnnotation, HighlighterInkAnnotation, RectAnnotation, ArrowAnnotation, Point, Stroke, Rect } from "../../types";

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

interface ArrowPreview {
  start: Point;
  end: Point;
  controlPoint?: Point;
}

export function AnnotationCanvas({
  pageNumber,
  width,
  height,
  scale,
  marginOffset = 0,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentTool, getCurrentColor, getStrokeWidth, getHighlightOpacity, addAnnotation, deleteAnnotation, getAnnotationsForPage, getArrowSettings } =
    useAnnotationStore();
  const currentColor = getCurrentColor();
  const strokeWidth = getStrokeWidth();
  const highlightOpacity = getHighlightOpacity();
  const arrowSettings = getArrowSettings();

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<StrokePoint[]>([]);
  const erasedIdsRef = useRef<Set<string>>(new Set()); // Track erased annotations to avoid double-delete
  const [rectPreview, setRectPreview] = useState<RectPreview | null>(null);
  const [arrowPreview, setArrowPreview] = useState<ArrowPreview | null>(null);

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
  const arrowAnnotations = annotations.filter(
    (a): a is ArrowAnnotation => a.type === "arrow"
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

  // Find annotation at a given point (for eraser)
  const findAnnotationAtPoint = useCallback(
    (point: Point, eraserSize: number): string | null => {
      const hitRadius = eraserSize / 2;

      // Check ink annotations
      for (const annotation of inkAnnotations) {
        for (const stroke of annotation.strokes) {
          for (const p of stroke.points) {
            const dx = p.x - point.x;
            const dy = p.y - point.y;
            if (dx * dx + dy * dy < hitRadius * hitRadius) {
              return annotation.id;
            }
          }
        }
      }

      // Check highlighter ink annotations
      for (const annotation of highlighterInkAnnotations) {
        for (const stroke of annotation.strokes) {
          for (const p of stroke.points) {
            const dx = p.x - point.x;
            const dy = p.y - point.y;
            if (dx * dx + dy * dy < hitRadius * hitRadius) {
              return annotation.id;
            }
          }
        }
      }

      // Check rect annotations
      for (const annotation of rectAnnotations) {
        const r = annotation.rect;
        if (
          point.x >= r.x - hitRadius &&
          point.x <= r.x + r.width + hitRadius &&
          point.y >= r.y - hitRadius &&
          point.y <= r.y + r.height + hitRadius
        ) {
          // Check if near edge
          const nearLeft = Math.abs(point.x - r.x) < hitRadius;
          const nearRight = Math.abs(point.x - (r.x + r.width)) < hitRadius;
          const nearTop = Math.abs(point.y - r.y) < hitRadius;
          const nearBottom = Math.abs(point.y - (r.y + r.height)) < hitRadius;
          if (nearLeft || nearRight || nearTop || nearBottom) {
            return annotation.id;
          }
        }
      }

      // Check arrow annotations
      for (const annotation of arrowAnnotations) {
        // Check distance to line segment
        const { start, end } = annotation;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq === 0) {
          const d = Math.sqrt((point.x - start.x) ** 2 + (point.y - start.y) ** 2);
          if (d < hitRadius) return annotation.id;
        } else {
          const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
          const projX = start.x + t * dx;
          const projY = start.y + t * dy;
          const d = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
          if (d < hitRadius) return annotation.id;
        }
      }

      return null;
    },
    [inkAnnotations, highlighterInkAnnotations, rectAnnotations, arrowAnnotations]
  );

  // Erase annotation at point
  const eraseAtPoint = useCallback(
    (point: Point) => {
      const eraserSize = strokeWidth; // Use current stroke width as eraser size
      const annotationId = findAnnotationAtPoint(point, eraserSize);
      if (annotationId && !erasedIdsRef.current.has(annotationId)) {
        erasedIdsRef.current.add(annotationId);
        deleteAnnotation(annotationId);
      }
    },
    [findAnnotationAtPoint, deleteAnnotation, strokeWidth]
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

  // Draw arrow on canvas
  const drawArrow = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      start: Point,
      end: Point,
      color: string,
      strokeW: number,
      lineStyle: "solid" | "dashed" | "dotted" = "solid",
      curveStyle: "straight" | "curved" | "bezier" = "straight",
      headStyle: "arrow" | "circle" | "diamond" | "none" = "arrow",
      tailStyle: "none" | "arrow" | "circle" | "diamond" = "none",
      controlPoint?: Point,
      isPreview: boolean = false
    ) => {
      const sx = start.x * scale + marginOffset;
      const sy = start.y * scale;
      const ex = end.x * scale + marginOffset;
      const ey = end.y * scale;
      const cp = controlPoint
        ? { x: controlPoint.x * scale + marginOffset, y: controlPoint.y * scale }
        : undefined;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = strokeW * scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Set line style
      if (lineStyle === "dashed") {
        ctx.setLineDash([10 * scale, 5 * scale]);
      } else if (lineStyle === "dotted") {
        ctx.setLineDash([2 * scale, 4 * scale]);
      }

      if (isPreview) {
        ctx.globalAlpha = 0.6;
      }

      // Draw the line
      ctx.beginPath();
      ctx.moveTo(sx, sy);

      if (curveStyle === "curved" || curveStyle === "bezier") {
        // Use control point or auto-calculate for smooth curve
        const midX = (sx + ex) / 2;
        const midY = (sy + ey) / 2;
        const dx = ex - sx;
        const dy = ey - sy;
        const perpX = -dy * 0.3;
        const perpY = dx * 0.3;
        const autoCP = cp || { x: midX + perpX, y: midY + perpY };
        ctx.quadraticCurveTo(autoCP.x, autoCP.y, ex, ey);
      } else {
        ctx.lineTo(ex, ey);
      }
      ctx.stroke();

      // Calculate angle for arrow heads
      let endAngle: number;
      if (curveStyle !== "straight" && !cp) {
        const midX = (sx + ex) / 2;
        const midY = (sy + ey) / 2;
        const dx = ex - sx;
        const dy = ey - sy;
        const perpX = -dy * 0.3;
        const perpY = dx * 0.3;
        const ctrlX = midX + perpX;
        const ctrlY = midY + perpY;
        endAngle = Math.atan2(ey - ctrlY, ex - ctrlX);
      } else if (cp) {
        endAngle = Math.atan2(ey - cp.y, ex - cp.x);
      } else {
        endAngle = Math.atan2(ey - sy, ex - sx);
      }
      const startAngle = Math.atan2(sy - ey, sx - ex);

      ctx.setLineDash([]);

      // Draw head
      const headSize = strokeW * scale * 3;
      if (headStyle === "arrow") {
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(
          ex - headSize * Math.cos(endAngle - Math.PI / 6),
          ey - headSize * Math.sin(endAngle - Math.PI / 6)
        );
        ctx.lineTo(
          ex - headSize * Math.cos(endAngle + Math.PI / 6),
          ey - headSize * Math.sin(endAngle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } else if (headStyle === "circle") {
        ctx.beginPath();
        ctx.arc(ex, ey, headSize / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (headStyle === "diamond") {
        ctx.beginPath();
        ctx.moveTo(ex + headSize * Math.cos(endAngle), ey + headSize * Math.sin(endAngle));
        ctx.lineTo(ex + headSize * Math.cos(endAngle + Math.PI / 2) * 0.6, ey + headSize * Math.sin(endAngle + Math.PI / 2) * 0.6);
        ctx.lineTo(ex - headSize * Math.cos(endAngle), ey - headSize * Math.sin(endAngle));
        ctx.lineTo(ex + headSize * Math.cos(endAngle - Math.PI / 2) * 0.6, ey + headSize * Math.sin(endAngle - Math.PI / 2) * 0.6);
        ctx.closePath();
        ctx.fill();
      }

      // Draw tail
      if (tailStyle === "arrow") {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(
          sx - headSize * Math.cos(startAngle - Math.PI / 6),
          sy - headSize * Math.sin(startAngle - Math.PI / 6)
        );
        ctx.lineTo(
          sx - headSize * Math.cos(startAngle + Math.PI / 6),
          sy - headSize * Math.sin(startAngle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } else if (tailStyle === "circle") {
        ctx.beginPath();
        ctx.arc(sx, sy, headSize / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (tailStyle === "diamond") {
        ctx.beginPath();
        ctx.moveTo(sx + headSize * Math.cos(startAngle), sy + headSize * Math.sin(startAngle));
        ctx.lineTo(sx + headSize * Math.cos(startAngle + Math.PI / 2) * 0.6, sy + headSize * Math.sin(startAngle + Math.PI / 2) * 0.6);
        ctx.lineTo(sx - headSize * Math.cos(startAngle), sy - headSize * Math.sin(startAngle));
        ctx.lineTo(sx + headSize * Math.cos(startAngle - Math.PI / 2) * 0.6, sy + headSize * Math.sin(startAngle - Math.PI / 2) * 0.6);
        ctx.closePath();
        ctx.fill();
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

    // Draw existing arrow annotations
    arrowAnnotations.forEach((annotation) => {
      drawArrow(
        ctx,
        annotation.start,
        annotation.end,
        annotation.color,
        annotation.strokeWidth,
        annotation.lineStyle,
        annotation.curveStyle,
        annotation.headStyle,
        annotation.tailStyle,
        annotation.controlPoint
      );
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

    // Draw arrow preview
    if (arrowPreview) {
      drawArrow(
        ctx,
        arrowPreview.start,
        arrowPreview.end,
        currentColor,
        strokeWidth,
        arrowSettings.lineStyle,
        arrowSettings.curveStyle,
        arrowSettings.headStyle,
        arrowSettings.tailStyle,
        arrowPreview.controlPoint,
        true
      );
    }
  }, [inkAnnotations, highlighterInkAnnotations, rectAnnotations, arrowAnnotations, currentTool, currentColor, strokeWidth, highlightOpacity, arrowSettings, drawStroke, drawRect, drawArrow, rectPreview, arrowPreview]);

  // Re-render when annotations change
  useEffect(() => {
    renderAnnotations();
  }, [renderAnnotations]);

  // Handle pointer events
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const drawingTools = ["pen", "highlighter", "eraser", "rect", "arrow"];
      if (!drawingTools.includes(currentTool)) return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const x = e.clientX - canvasRect.left;
      const y = e.clientY - canvasRect.top;
      const pdfPoint = screenToPdf(x, y);

      isDrawingRef.current = true;

      if (currentTool === "eraser") {
        // Clear tracked erased IDs for new eraser stroke
        erasedIdsRef.current.clear();
        eraseAtPoint(pdfPoint);
      } else if (currentTool === "rect") {
        setRectPreview({
          startX: pdfPoint.x,
          startY: pdfPoint.y,
          endX: pdfPoint.x,
          endY: pdfPoint.y,
        });
      } else if (currentTool === "arrow") {
        setArrowPreview({
          start: pdfPoint,
          end: pdfPoint,
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
    [currentTool, screenToPdf, eraseAtPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;

      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const x = e.clientX - canvasRect.left;
      const y = e.clientY - canvasRect.top;
      const pdfPoint = screenToPdf(x, y);

      if (currentTool === "eraser") {
        eraseAtPoint(pdfPoint);
      } else if (currentTool === "rect") {
        setRectPreview((prev) =>
          prev ? { ...prev, endX: pdfPoint.x, endY: pdfPoint.y } : null
        );
      } else if (currentTool === "arrow") {
        setArrowPreview((prev) =>
          prev ? { ...prev, end: pdfPoint } : null
        );
        renderAnnotations();
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
    [currentTool, screenToPdf, renderAnnotations, eraseAtPoint]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;

      e.currentTarget.releasePointerCapture(e.pointerId);
      isDrawingRef.current = false;

      if (currentTool === "eraser") {
        // Eraser actions are handled in pointer down/move, just cleanup
        erasedIdsRef.current.clear();
        renderAnnotations();
        return;
      }

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
      } else if (currentTool === "arrow" && arrowPreview) {
        // Create arrow annotation
        const dx = arrowPreview.end.x - arrowPreview.start.x;
        const dy = arrowPreview.end.y - arrowPreview.start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 10 / scale) {
          const annotation: ArrowAnnotation = {
            id: crypto.randomUUID(),
            type: "arrow",
            pageNumber,
            createdAt: new Date(),
            updatedAt: new Date(),
            color: currentColor,
            start: arrowPreview.start,
            end: arrowPreview.end,
            strokeWidth,
            lineStyle: arrowSettings.lineStyle,
            curveStyle: arrowSettings.curveStyle,
            headStyle: arrowSettings.headStyle,
            tailStyle: arrowSettings.tailStyle,
            controlPoint: arrowPreview.controlPoint,
          };
          addAnnotation(annotation);
        }
        setArrowPreview(null);
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
    [currentTool, currentColor, strokeWidth, highlightOpacity, pageNumber, addAnnotation, renderAnnotations, rectPreview, arrowPreview, arrowSettings, scale]
  );

  const handlePointerCancel = useCallback(() => {
    isDrawingRef.current = false;
    currentStrokeRef.current = [];
    setRectPreview(null);
    setArrowPreview(null);
    renderAnnotations();
  }, [renderAnnotations]);

  const isInteractive = ["pen", "highlighter", "eraser", "rect", "arrow"].includes(currentTool);

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
