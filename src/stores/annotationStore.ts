import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Annotation, AnnotationTool } from "../types";

// Tool-specific settings
export interface ToolSettings {
  color: string;
  opacity: number;
  thickness: number;
}

interface AnnotationState {
  // Annotations indexed by page number
  annotations: Map<number, Annotation[]>;

  // Current tool
  currentTool: AnnotationTool;

  // Per-tool settings
  toolSettings: Record<string, ToolSettings>;

  // Selection
  selectedAnnotationId: string | null;

  // Undo/Redo
  undoStack: AnnotationAction[];
  redoStack: AnnotationAction[];

  // Actions
  setCurrentTool: (tool: AnnotationTool) => void;
  getToolSettings: (tool: AnnotationTool) => ToolSettings;
  setToolColor: (tool: AnnotationTool, color: string) => void;
  setToolOpacity: (tool: AnnotationTool, opacity: number) => void;
  setToolThickness: (tool: AnnotationTool, thickness: number) => void;

  // Legacy getters for current tool
  getCurrentColor: () => string;
  getStrokeWidth: () => number;
  getHighlightOpacity: () => number;

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

// Default settings for each tool
const DEFAULT_TOOL_SETTINGS: Record<string, ToolSettings> = {
  pen: { color: "#000000", opacity: 1, thickness: 2 },
  highlighter: { color: "#fef08a", opacity: 0.4, thickness: 20 },
  underline: { color: "#ef4444", opacity: 1, thickness: 2 },
  strikeout: { color: "#ef4444", opacity: 1, thickness: 2 },
  eraser: { color: "#ffffff", opacity: 1, thickness: 20 },
  note: { color: "#fef08a", opacity: 1, thickness: 1 },
  rect: { color: "#3b82f6", opacity: 0.3, thickness: 2 },
  arrow: { color: "#000000", opacity: 1, thickness: 2 },
  select: { color: "#3b82f6", opacity: 1, thickness: 1 },
};

// Preset colors for each tool type
export const TOOL_COLOR_PRESETS: Record<string, string[]> = {
  pen: ["#000000", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#ffffff"],
  highlighter: ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#e9d5ff", "#fecaca", "#d1fae5"],
  underline: ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#000000"],
  strikeout: ["#ef4444", "#000000", "#3b82f6", "#f59e0b", "#8b5cf6"],
  eraser: ["#ffffff"],
  note: ["#fef08a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#fed7aa", "#e9d5ff"],
  rect: ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#000000"],
  arrow: ["#000000", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b"],
};

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set, get) => ({
      // Initial state
      annotations: new Map(),
      currentTool: "select",
      toolSettings: { ...DEFAULT_TOOL_SETTINGS },
      selectedAnnotationId: null,
      undoStack: [],
      redoStack: [],

      // Actions
      setCurrentTool: (tool) => set({ currentTool: tool }),

      getToolSettings: (tool) => {
        const { toolSettings } = get();
        return toolSettings[tool] || DEFAULT_TOOL_SETTINGS[tool] || DEFAULT_TOOL_SETTINGS.pen;
      },

      setToolColor: (tool, color) => {
        const { toolSettings } = get();
        set({
          toolSettings: {
            ...toolSettings,
            [tool]: { ...toolSettings[tool], color },
          },
        });
      },

      setToolOpacity: (tool, opacity) => {
        const { toolSettings } = get();
        set({
          toolSettings: {
            ...toolSettings,
            [tool]: { ...toolSettings[tool], opacity: Math.max(0.1, Math.min(1, opacity)) },
          },
        });
      },

      setToolThickness: (tool, thickness) => {
        const { toolSettings } = get();
        set({
          toolSettings: {
            ...toolSettings,
            [tool]: { ...toolSettings[tool], thickness: Math.max(1, Math.min(50, thickness)) },
          },
        });
      },

      // Legacy getters
      getCurrentColor: () => {
        const { currentTool, toolSettings } = get();
        return toolSettings[currentTool]?.color || "#000000";
      },

      getStrokeWidth: () => {
        const { currentTool, toolSettings } = get();
        return toolSettings[currentTool]?.thickness || 2;
      },

      getHighlightOpacity: () => {
        const { currentTool, toolSettings } = get();
        return toolSettings[currentTool]?.opacity || 0.4;
      },

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
    }),
    {
      name: "pdf-annotator-tools",
      partialize: (state) => ({ toolSettings: state.toolSettings }),
    }
  )
);
