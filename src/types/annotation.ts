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

export interface HighlighterInkAnnotation extends BaseAnnotation {
  type: "highlighterInk";
  strokes: Stroke[];
  opacity: number;
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
  lineStyle: "solid" | "dashed" | "dotted";
  curveStyle: "straight" | "curved" | "bezier";
  headStyle: "arrow" | "circle" | "diamond" | "none";
  tailStyle: "none" | "arrow" | "circle" | "diamond";
  // Control point for bezier curves (optional)
  controlPoint?: Point;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export interface TextBoxAnnotation extends BaseAnnotation {
  type: "textbox";
  position: Point;
  width: number;
  height: number;
  content: string;
  style: TextStyle;
  backgroundColor?: string;
  borderColor?: string;
}

export type Annotation =
  | InkAnnotation
  | HighlighterInkAnnotation
  | HighlightAnnotation
  | UnderlineAnnotation
  | StrikeoutAnnotation
  | NoteAnnotation
  | RectAnnotation
  | ArrowAnnotation
  | TextBoxAnnotation;

export type AnnotationTool =
  | "select"
  | "pen"
  | "highlighter"
  | "underline"
  | "strikeout"
  | "eraser"
  | "note"
  | "rect"
  | "arrow"
  | "text";

// Selection sub-modes for the select tool
export type SelectionMode = "lasso" | "rectangle" | "text";
