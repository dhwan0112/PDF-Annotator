export * from "./annotation";

export interface PdfMetadata {
  path: string;
  fileName: string;
  pageCount: number | null;
  title: string | null;
  author: string | null;
}

export interface Bookmark {
  id: string;
  pageNumber: number;
  title: string;
  note?: string;
  color?: string;
  createdAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export type Theme = "light" | "dark" | "system";

export type ViewMode = "single" | "continuous";

// Study Group - for grouping multiple PDFs together (like MarginNote's notebook)
export interface StudyGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  documentIds: string[]; // References to documents in libraryStore
  createdAt: Date;
  updatedAt: Date;
}

// Margin Note - notes in the margin area beside the PDF
export interface MarginNote {
  id: string;
  documentId: string; // Reference to the document
  pageNumber: number;
  // Position relative to page (y position, 0-1 normalized)
  yPosition: number;
  // Content
  content: string;
  // Optional link to annotation
  linkedAnnotationId?: string;
  // Styling
  color: string;
  collapsed: boolean;
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Mind Map types
export interface MindMapNode {
  id: string;
  // Source reference
  sourceType: "margin_note" | "annotation" | "custom";
  sourceId?: string; // MarginNote.id or Annotation.id
  documentId?: string;
  // Position in mind map canvas
  x: number;
  y: number;
  // Content
  title: string;
  content?: string;
  color: string;
  // Node styling
  width: number;
  height: number;
  collapsed: boolean;
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface MindMapEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  color: string;
  style: "solid" | "dashed" | "dotted";
}

export interface MindMap {
  id: string;
  studyGroupId: string;
  name: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  // Canvas settings
  zoom: number;
  panX: number;
  panY: number;
  createdAt: Date;
  updatedAt: Date;
}
