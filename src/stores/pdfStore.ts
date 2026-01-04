import { create } from "zustand";
import type { PdfMetadata, ViewMode } from "../types";

interface PdfState {
  // File info
  filePath: string | null;
  metadata: PdfMetadata | null;

  // Navigation
  currentPage: number;
  totalPages: number;

  // View settings
  zoomLevel: number;
  viewMode: ViewMode;
  scrollPosition: number;

  // Actions
  setFile: (filePath: string, metadata: PdfMetadata) => void;
  clearFile: () => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setZoomLevel: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToWidth: () => void;
  fitToPage: () => void;
  setViewMode: (mode: ViewMode) => void;
  setScrollPosition: (position: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
}

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;

export const usePdfStore = create<PdfState>((set, get) => ({
  // Initial state
  filePath: null,
  metadata: null,
  currentPage: 1,
  totalPages: 0,
  zoomLevel: 1.0,
  viewMode: "continuous",
  scrollPosition: 0,

  // Actions
  setFile: (filePath, metadata) =>
    set({
      filePath,
      metadata,
      currentPage: 1,
      scrollPosition: 0,
    }),

  clearFile: () =>
    set({
      filePath: null,
      metadata: null,
      currentPage: 1,
      totalPages: 0,
      scrollPosition: 0,
    }),

  setCurrentPage: (page) => {
    const { totalPages } = get();
    if (page >= 1 && page <= totalPages) {
      set({ currentPage: page });
    }
  },

  setTotalPages: (total) => set({ totalPages: total }),

  setZoomLevel: (zoom) => {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    set({ zoomLevel: clampedZoom });
  },

  zoomIn: () => {
    const { zoomLevel } = get();
    const nextLevel = ZOOM_LEVELS.find((z) => z > zoomLevel);
    if (nextLevel) {
      set({ zoomLevel: nextLevel });
    }
  },

  zoomOut: () => {
    const { zoomLevel } = get();
    const prevLevel = [...ZOOM_LEVELS].reverse().find((z) => z < zoomLevel);
    if (prevLevel) {
      set({ zoomLevel: prevLevel });
    }
  },

  fitToWidth: () => {
    // This will be implemented when we have container dimensions
    set({ zoomLevel: 1.0 });
  },

  fitToPage: () => {
    // This will be implemented when we have container dimensions
    set({ zoomLevel: 1.0 });
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setScrollPosition: (position) => set({ scrollPosition: position }),

  goToNextPage: () => {
    const { currentPage, totalPages } = get();
    if (currentPage < totalPages) {
      set({ currentPage: currentPage + 1 });
    }
  },

  goToPreviousPage: () => {
    const { currentPage } = get();
    if (currentPage > 1) {
      set({ currentPage: currentPage - 1 });
    }
  },

  goToFirstPage: () => set({ currentPage: 1 }),

  goToLastPage: () => {
    const { totalPages } = get();
    set({ currentPage: totalPages });
  },
}));
