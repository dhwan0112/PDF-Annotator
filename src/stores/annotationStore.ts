import { create } from "zustand";
import type { Annotation, AnnotationTool } from "../types";

interface AnnotationState {
  // Annotations indexed by page number
  annotations: Map<number, Annotation[]>;

  // Current tool settings
  currentTool: AnnotationTool;
  currentColor: string;
  strokeWidth: number;
  highlightOpacity: number;

  // Selection
  selectedAnnotationId: string | null;

  // Undo/Redo
  undoStack: AnnotationAction[];
  redoStack: AnnotationAction[];

  // Actions
  setCurrentTool: (tool: AnnotationTool) => void;
  setCurrentColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setHighlightOpacity: (opacity: number) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  getAnnotationsForPage: (pageNumber: number) => Annotation[];
  undo: () => void;
  redo: () => void;
  clearAnnotations: () => void;
}

interface AnnotationAction {
  type: "add" | "update" | "delete";
  annotation: Annotation;
  previousState?: Annotation;
}

const PRESET_COLORS = {
  pen: ["#000000", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b"],
  highlighter: ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"],
};

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  // Initial state
  annotations: new Map(),
  currentTool: "select",
  currentColor: "#000000",
  strokeWidth: 2,
  highlightOpacity: 0.4,
  selectedAnnotationId: null,
  undoStack: [],
  redoStack: [],

  // Actions
  setCurrentTool: (tool) => {
    const color =
      tool === "highlighter"
        ? PRESET_COLORS.highlighter[0]
        : PRESET_COLORS.pen[0];
    set({ currentTool: tool, currentColor: color });
  },

  setCurrentColor: (color) => set({ currentColor: color }),

  setStrokeWidth: (width) => set({ strokeWidth: width }),

  setHighlightOpacity: (opacity) => set({ highlightOpacity: opacity }),

  addAnnotation: (annotation) => {
    const { annotations, undoStack } = get();
    const pageAnnotations = annotations.get(annotation.pageNumber) || [];
    const newAnnotations = new Map(annotations);
    newAnnotations.set(annotation.pageNumber, [...pageAnnotations, annotation]);

    set({
      annotations: newAnnotations,
      undoStack: [...undoStack, { type: "add", annotation }],
      redoStack: [],
    });
  },

  updateAnnotation: (id, updates) => {
    const { annotations, undoStack } = get();
    const newAnnotations = new Map(annotations);

    for (const [pageNum, pageAnnotations] of annotations) {
      const index = pageAnnotations.findIndex((a) => a.id === id);
      if (index !== -1) {
        const previousState = pageAnnotations[index];
        const updated = { ...previousState, ...updates, updatedAt: new Date() };
        const newPageAnnotations = [...pageAnnotations];
        newPageAnnotations[index] = updated as Annotation;
        newAnnotations.set(pageNum, newPageAnnotations);

        set({
          annotations: newAnnotations,
          undoStack: [
            ...undoStack,
            { type: "update", annotation: updated as Annotation, previousState },
          ],
          redoStack: [],
        });
        return;
      }
    }
  },

  deleteAnnotation: (id) => {
    const { annotations, undoStack } = get();
    const newAnnotations = new Map(annotations);

    for (const [pageNum, pageAnnotations] of annotations) {
      const index = pageAnnotations.findIndex((a) => a.id === id);
      if (index !== -1) {
        const deleted = pageAnnotations[index];
        const newPageAnnotations = pageAnnotations.filter((a) => a.id !== id);
        newAnnotations.set(pageNum, newPageAnnotations);

        set({
          annotations: newAnnotations,
          selectedAnnotationId: null,
          undoStack: [...undoStack, { type: "delete", annotation: deleted }],
          redoStack: [],
        });
        return;
      }
    }
  },

  selectAnnotation: (id) => set({ selectedAnnotationId: id }),

  getAnnotationsForPage: (pageNumber) => {
    const { annotations } = get();
    return annotations.get(pageNumber) || [];
  },

  undo: () => {
    const { undoStack, redoStack, annotations } = get();
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    const newAnnotations = new Map(annotations);

    switch (action.type) {
      case "add": {
        const pageAnnotations =
          annotations.get(action.annotation.pageNumber) || [];
        newAnnotations.set(
          action.annotation.pageNumber,
          pageAnnotations.filter((a) => a.id !== action.annotation.id)
        );
        break;
      }
      case "delete": {
        const pageAnnotations =
          annotations.get(action.annotation.pageNumber) || [];
        newAnnotations.set(action.annotation.pageNumber, [
          ...pageAnnotations,
          action.annotation,
        ]);
        break;
      }
      case "update": {
        if (action.previousState) {
          const pageAnnotations =
            annotations.get(action.annotation.pageNumber) || [];
          const index = pageAnnotations.findIndex(
            (a) => a.id === action.annotation.id
          );
          if (index !== -1) {
            const newPageAnnotations = [...pageAnnotations];
            newPageAnnotations[index] = action.previousState;
            newAnnotations.set(action.annotation.pageNumber, newPageAnnotations);
          }
        }
        break;
      }
    }

    set({
      annotations: newAnnotations,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, action],
    });
  },

  redo: () => {
    const { undoStack, redoStack, annotations } = get();
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];
    const newAnnotations = new Map(annotations);

    switch (action.type) {
      case "add": {
        const pageAnnotations =
          annotations.get(action.annotation.pageNumber) || [];
        newAnnotations.set(action.annotation.pageNumber, [
          ...pageAnnotations,
          action.annotation,
        ]);
        break;
      }
      case "delete": {
        const pageAnnotations =
          annotations.get(action.annotation.pageNumber) || [];
        newAnnotations.set(
          action.annotation.pageNumber,
          pageAnnotations.filter((a) => a.id !== action.annotation.id)
        );
        break;
      }
      case "update": {
        const pageAnnotations =
          annotations.get(action.annotation.pageNumber) || [];
        const index = pageAnnotations.findIndex(
          (a) => a.id === action.annotation.id
        );
        if (index !== -1) {
          const newPageAnnotations = [...pageAnnotations];
          newPageAnnotations[index] = action.annotation;
          newAnnotations.set(action.annotation.pageNumber, newPageAnnotations);
        }
        break;
      }
    }

    set({
      annotations: newAnnotations,
      undoStack: [...undoStack, action],
      redoStack: redoStack.slice(0, -1),
    });
  },

  clearAnnotations: () =>
    set({
      annotations: new Map(),
      selectedAnnotationId: null,
      undoStack: [],
      redoStack: [],
    }),
}));
