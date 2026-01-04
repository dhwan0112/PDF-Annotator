export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Stroke {
  points: Point[];
  pressure: number[];
  color: string;
  width: number;
}

export interface BaseAnnotation {
  id: string;
  pageNumber: number;
  createdAt: Date;
  updatedAt: Date;
  color: string;
}

export interface InkAnnotation extends BaseAnnotation {
  type: "ink";
  strokes: Stroke[];
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: "highlight";
  rects: Rect[];
  text: string;
}

export interface UnderlineAnnotation extends BaseAnnotation {
  type: "underline";
  rects: Rect[];
  text: string;
}

export interface StrikeoutAnnotation extends BaseAnnotation {
  type: "strikeout";
  rects: Rect[];
  text: string;
}

export interface NoteAnnotation extends BaseAnnotation {
  type: "note";
  position: Point;
  content: string;
}

export interface RectAnnotation extends BaseAnnotation {
  type: "rect";
  rect: Rect;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: "arrow";
  start: Point;
  end: Point;
  strokeWidth: number;
}

export type Annotation =
  | InkAnnotation
  | HighlightAnnotation
  | UnderlineAnnotation
  | StrikeoutAnnotation
  | NoteAnnotation
  | RectAnnotation
  | ArrowAnnotation;

export type AnnotationTool =
  | "select"
  | "pen"
  | "highlighter"
  | "underline"
  | "strikeout"
  | "eraser"
  | "note"
  | "rect"
  | "arrow";
