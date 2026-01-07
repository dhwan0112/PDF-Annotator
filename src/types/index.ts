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
// Also used for tab grouping in the tab bar
export interface StudyGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  documentIds: string[]; // References to documents in libraryStore
  collapsed: boolean; // UI state for tab bar collapse/expand
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
  filePath?: string; // File path for opening the document
  pageNumber?: number; // Page number for navigation
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

// BibTeX entry types
export type BibTeXEntryType =
  | "article"      // Journal article
  | "inproceedings" // Conference paper
  | "book"         // Book
  | "incollection" // Book chapter
  | "phdthesis"    // PhD thesis
  | "mastersthesis" // Master's thesis
  | "techreport"   // Technical report
  | "misc";        // Miscellaneous

// BibTeX metadata for academic papers
export interface BibTeXMetadata {
  // Entry identification
  entryType: BibTeXEntryType;
  citeKey: string;           // e.g., "Kim2024deeplearning"

  // Required fields
  title: string;
  authors: string[];         // ["Kim, Minjun", "Lee, Soyeon"]
  year?: number;

  // Journal article fields
  journal?: string;
  volume?: string;
  number?: string;           // Issue number
  pages?: string;            // e.g., "123--156"

  // Conference fields
  booktitle?: string;        // Conference name for inproceedings

  // Book fields
  publisher?: string;
  edition?: string;

  // Thesis fields
  school?: string;

  // Technical report fields
  institution?: string;

  // Common optional fields
  doi?: string;
  url?: string;
  isbn?: string;
  issn?: string;
  abstract?: string;
  keywords?: string[];
  note?: string;

  // Extraction metadata
  extractedAt?: Date;
  extractionMethod?: "manual" | "metadata" | "doi_lookup" | "text_parsing";
  confidence?: number;       // 0-1, how confident is the extraction
}
