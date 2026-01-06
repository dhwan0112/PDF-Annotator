import { create } from "zustand";
import { persist } from "zustand/middleware";
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
  rotation: number;
  viewMode: ViewMode;
  scrollPosition: number;

  // Actions
  setFile: (filePath: string, metadata: PdfMetadata) => void;
  setFilePath: (filePath: string) => void;
  clearFile: () => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setZoomLevel: (zoom: number) => void;
  adjustZoom: (delta: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToWidth: () => void;
  fitToPage: () => void;
  setViewMode: (mode: ViewMode) => void;
  setScrollPosition: (position: number) => void;
  goToPage: (page: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  rotateClockwise: () => void;
  rotateCounterClockwise: () => void;
}

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;

export const usePdfStore = create<PdfState>()(
  persist(
    (set, get) => ({
      // Initial state
      filePath: null,
      metadata: null,
      currentPage: 1,
      totalPages: 0,
      zoomLevel: 1.0,
      rotation: 0,
      viewMode: "continuous",
      scrollPosition: 0,

  // Actions
  setFile: (filePath, metadata) =>
    set({
      filePath,
      metadata,
      currentPage: 1,
      scrollPosition: 0,
      rotation: 0,
    }),

  setFilePath: (filePath) =>
    set({
      filePath,
      currentPage: 1,
      scrollPosition: 0,
      rotation: 0,
    }),

  clearFile: () =>
    set({
      filePath: null,
      metadata: null,
      currentPage: 1,
      totalPages: 0,
      scrollPosition: 0,
      rotation: 0,
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

  adjustZoom: (delta) => {
    const { zoomLevel } = get();
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
    set({ zoomLevel: newZoom });
  },

  zoomIn: () => {
    const { zoomLevel } = get();
    const nextLevel = ZOOM_LEVELS.find((z) => z > zoomLevel);
    if (nextLevel) {
      set({ zoomLevel: nextLevel });
    } else if (zoomLevel < MAX_ZOOM) {
      set({ zoomLevel: Math.min(zoomLevel + 0.25, MAX_ZOOM) });
    }
  },

  zoomOut: () => {
    const { zoomLevel } = get();
    const prevLevel = [...ZOOM_LEVELS].reverse().find((z) => z < zoomLevel);
    if (prevLevel) {
      set({ zoomLevel: prevLevel });
    } else if (zoomLevel > MIN_ZOOM) {
      set({ zoomLevel: Math.max(zoomLevel - 0.25, MIN_ZOOM) });
    }
  },

  fitToWidth: () => {
    set({ zoomLevel: 1.0 });
  },

  fitToPage: () => {
    set({ zoomLevel: 1.0 });
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setScrollPosition: (position) => set({ scrollPosition: position }),

  goToPage: (page) => {
    const { totalPages } = get();
    if (page >= 1 && page <= totalPages) {
      set({ currentPage: page });
    }
  },

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

  rotateClockwise: () => {
    const { rotation } = get();
    set({ rotation: (rotation + 90) % 360 });
  },

  rotateCounterClockwise: () => {
    const { rotation } = get();
    set({ rotation: (rotation - 90 + 360) % 360 });
  },
    }),
    {
      name: "pdf-annotator-session",
      partialize: (state) => ({
        filePath: state.filePath,
        metadata: state.metadata,
        currentPage: state.currentPage,
        zoomLevel: state.zoomLevel,
        rotation: state.rotation,
        viewMode: state.viewMode,
      }),
    }
  )
);
