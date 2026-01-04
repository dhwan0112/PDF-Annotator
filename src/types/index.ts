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
