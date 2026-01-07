import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Annotation, AnnotationTool, SelectionMode } from "../types";

// Tool-specific settings
export interface ToolSettings {
  color: string;
  opacity: number;
  thickness: number;
}

// Arrow-specific settings
export interface ArrowSettings {
  lineStyle: "solid" | "dashed" | "dotted";
  curveStyle: "straight" | "curved" | "bezier";
  headStyle: "arrow" | "circle" | "diamond" | "none";
  tailStyle: "none" | "arrow" | "circle" | "diamond";
}

// Drawing tools that can be used with pen tablet
const DRAWING_TOOLS: AnnotationTool[] = ["pen", "highlighter", "eraser", "underline", "strikeout"];

interface AnnotationState {
  // Annotations indexed by page number
  annotations: Map<number, Annotation[]>;

  // Current tool
  currentTool: AnnotationTool;

  // Selection mode (lasso, rectangle, text)
  selectionMode: SelectionMode;

  // Last used drawing tool (for pen tablet auto-switch)
  lastDrawingTool: AnnotationTool;

  // Per-tool settings
  toolSettings: Record<string, ToolSettings>;

  // Arrow-specific settings
  arrowSettings: ArrowSettings;

  // Selection (multi-select support)
  selectedAnnotationIds: Set<string>;
  // Backwards compatibility - returns first selected or null
  selectedAnnotationId: string | null;

  // Undo/Redo
  undoStack: AnnotationAction[];
  redoStack: AnnotationAction[];

  // Actions
  setCurrentTool: (tool: AnnotationTool) => void;
  setSelectionMode: (mode: SelectionMode) => void;
  switchToPenTool: () => void; // For pen tablet detection
  getToolSettings: (tool: AnnotationTool) => ToolSettings;
  setToolColor: (tool: AnnotationTool, color: string) => void;
  setToolOpacity: (tool: AnnotationTool, opacity: number) => void;
  setToolThickness: (tool: AnnotationTool, thickness: number) => void;

  // Arrow settings
  getArrowSettings: () => ArrowSettings;
  setArrowLineStyle: (style: ArrowSettings["lineStyle"]) => void;
  setArrowCurveStyle: (style: ArrowSettings["curveStyle"]) => void;
  setArrowHeadStyle: (style: ArrowSettings["headStyle"]) => void;
  setArrowTailStyle: (style: ArrowSettings["tailStyle"]) => void;

  // Legacy getters for current tool
  getCurrentColor: () => string;
  getStrokeWidth: () => number;
  getHighlightOpacity: () => number;

  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  deleteSelectedAnnotations: () => void;
  selectAnnotation: (id: string | null) => void;
  // Multi-select methods
  selectAnnotations: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  isAnnotationSelected: (id: string) => boolean;
  getSelectedAnnotations: () => Annotation[];
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
  text: { color: "#000000", opacity: 1, thickness: 14 }, // thickness = font size
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
  text: ["#000000", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6"],
};

// Default arrow settings
const DEFAULT_ARROW_SETTINGS: ArrowSettings = {
  lineStyle: "solid",
  curveStyle: "straight",
  headStyle: "arrow",
  tailStyle: "none",
};

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set, get) => ({
      // Initial state
      annotations: new Map(),
      currentTool: "select",
      selectionMode: "rectangle",
      lastDrawingTool: "pen",
      toolSettings: { ...DEFAULT_TOOL_SETTINGS },
      arrowSettings: { ...DEFAULT_ARROW_SETTINGS },
      selectedAnnotationIds: new Set<string>(),
      selectedAnnotationId: null,
      undoStack: [],
      redoStack: [],

      // Actions
      setCurrentTool: (tool) => {
        // Track last drawing tool for pen tablet auto-switch
        if (DRAWING_TOOLS.includes(tool)) {
          set({ currentTool: tool, lastDrawingTool: tool });
        } else {
          set({ currentTool: tool });
        }
      },

      setSelectionMode: (mode) => {
        set({ selectionMode: mode });
      },

      // Switch to last used drawing tool (for pen tablet)
      switchToPenTool: () => {
        const { lastDrawingTool, currentTool } = get();
        // Only switch if not already using a drawing tool
        if (!DRAWING_TOOLS.includes(currentTool)) {
          set({ currentTool: lastDrawingTool });
        }
      },

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

      // Arrow settings
      getArrowSettings: () => get().arrowSettings,

      setArrowLineStyle: (style) => {
        set({ arrowSettings: { ...get().arrowSettings, lineStyle: style } });
      },

      setArrowCurveStyle: (style) => {
        set({ arrowSettings: { ...get().arrowSettings, curveStyle: style } });
      },

      setArrowHeadStyle: (style) => {
        set({ arrowSettings: { ...get().arrowSettings, headStyle: style } });
      },

      setArrowTailStyle: (style) => {
        set({ arrowSettings: { ...get().arrowSettings, tailStyle: style } });
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
        const { annotations, undoStack, selectedAnnotationIds } = get();
        const newAnnotations = new Map(annotations);

        for (const [pageNum, pageAnnotations] of annotations) {
          const index = pageAnnotations.findIndex((a) => a.id === id);
          if (index !== -1) {
            const deleted = pageAnnotations[index];
            const newPageAnnotations = pageAnnotations.filter((a) => a.id !== id);
            newAnnotations.set(pageNum, newPageAnnotations);

            // Remove from selection
            const newSelectedIds = new Set(selectedAnnotationIds);
            newSelectedIds.delete(id);

            set({
              annotations: newAnnotations,
              selectedAnnotationIds: newSelectedIds,
              selectedAnnotationId: newSelectedIds.size > 0 ? Array.from(newSelectedIds)[0] : null,
              undoStack: [...undoStack, { type: "delete", annotation: deleted }],
              redoStack: [],
            });
            return;
          }
        }
      },

      deleteSelectedAnnotations: () => {
        const { annotations, undoStack, selectedAnnotationIds } = get();
        if (selectedAnnotationIds.size === 0) return;

        const newAnnotations = new Map(annotations);
        const newUndoStack = [...undoStack];

        // Delete all selected annotations
        for (const [pageNum, pageAnnotations] of annotations) {
          const toDelete = pageAnnotations.filter((a) => selectedAnnotationIds.has(a.id));
          if (toDelete.length > 0) {
            const remaining = pageAnnotations.filter((a) => !selectedAnnotationIds.has(a.id));
            newAnnotations.set(pageNum, remaining);

            // Add to undo stack
            for (const deleted of toDelete) {
              newUndoStack.push({ type: "delete", annotation: deleted });
            }
          }
        }

        set({
          annotations: newAnnotations,
          selectedAnnotationIds: new Set(),
          selectedAnnotationId: null,
          undoStack: newUndoStack,
          redoStack: [],
        });
      },

      selectAnnotation: (id) => {
        if (id === null) {
          set({ selectedAnnotationIds: new Set(), selectedAnnotationId: null });
        } else {
          set({ selectedAnnotationIds: new Set([id]), selectedAnnotationId: id });
        }
      },

      selectAnnotations: (ids) => {
        const newSet = new Set(ids);
        set({
          selectedAnnotationIds: newSet,
          selectedAnnotationId: ids.length > 0 ? ids[0] : null,
        });
      },

      addToSelection: (id) => {
        const { selectedAnnotationIds } = get();
        const newSet = new Set(selectedAnnotationIds);
        newSet.add(id);
        set({
          selectedAnnotationIds: newSet,
          selectedAnnotationId: newSet.size > 0 ? Array.from(newSet)[0] : null,
        });
      },

      removeFromSelection: (id) => {
        const { selectedAnnotationIds } = get();
        const newSet = new Set(selectedAnnotationIds);
        newSet.delete(id);
        set({
          selectedAnnotationIds: newSet,
          selectedAnnotationId: newSet.size > 0 ? Array.from(newSet)[0] : null,
        });
      },

      toggleSelection: (id) => {
        const { selectedAnnotationIds } = get();
        const newSet = new Set(selectedAnnotationIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        set({
          selectedAnnotationIds: newSet,
          selectedAnnotationId: newSet.size > 0 ? Array.from(newSet)[0] : null,
        });
      },

      clearSelection: () => {
        set({ selectedAnnotationIds: new Set(), selectedAnnotationId: null });
      },

      isAnnotationSelected: (id) => {
        return get().selectedAnnotationIds.has(id);
      },

      getSelectedAnnotations: () => {
        const { annotations, selectedAnnotationIds } = get();
        const selected: Annotation[] = [];
        for (const pageAnnotations of annotations.values()) {
          for (const annotation of pageAnnotations) {
            if (selectedAnnotationIds.has(annotation.id)) {
              selected.push(annotation);
            }
          }
        }
        return selected;
      },

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
          selectedAnnotationIds: new Set(),
          selectedAnnotationId: null,
          undoStack: [],
          redoStack: [],
        }),
    }),
    {
      name: "marginalia-tools",
      partialize: (state) => ({
        toolSettings: state.toolSettings,
        lastDrawingTool: state.lastDrawingTool,
        arrowSettings: state.arrowSettings,
        selectionMode: state.selectionMode,
      }),
    }
  )
);
