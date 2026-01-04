import { useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAnnotationStore, usePdfStore } from "../stores";
import type { Annotation } from "../types";

// Serialized annotation with dates as strings
type SerializedAnnotation = Omit<Annotation, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

interface SerializedAnnotations {
  version: number;
  annotations: Record<string, SerializedAnnotation[]>;
}

export function useAnnotationPersistence() {
  const { filePath } = usePdfStore();
  const { annotations, clearAnnotations } = useAnnotationStore();
  const isLoadingRef = useRef(false);
  const lastSavedRef = useRef<string>("");

  // Convert Map to serializable object
  const serializeAnnotations = useCallback((): SerializedAnnotations => {
    const serialized: Record<string, SerializedAnnotation[]> = {};
    annotations.forEach((pageAnnotations, pageNumber) => {
      serialized[pageNumber.toString()] = pageAnnotations.map((a) => ({
        ...a,
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
        updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : String(a.updatedAt),
      })) as SerializedAnnotation[];
    });
    return { version: 1, annotations: serialized };
  }, [annotations]);

  // Convert serialized object back to Map
  const deserializeAnnotations = useCallback(
    (data: SerializedAnnotations): Map<number, Annotation[]> => {
      const map = new Map<number, Annotation[]>();
      Object.entries(data.annotations).forEach(([pageNum, pageAnnotations]) => {
        map.set(
          parseInt(pageNum, 10),
          pageAnnotations.map((a) => ({
            ...a,
            createdAt: new Date(a.createdAt),
            updatedAt: new Date(a.updatedAt),
          })) as Annotation[]
        );
      });
      return map;
    },
    []
  );

  // Save annotations
  const saveAnnotations = useCallback(async () => {
    if (!filePath || isLoadingRef.current) return;

    const serialized = serializeAnnotations();
    const json = JSON.stringify(serialized, null, 2);

    // Skip if nothing changed
    if (json === lastSavedRef.current) return;

    try {
      await invoke("save_annotations", {
        pdfPath: filePath,
        annotationsJson: json,
      });
      lastSavedRef.current = json;
      console.log("Annotations saved");
    } catch (error) {
      console.error("Failed to save annotations:", error);
    }
  }, [filePath, serializeAnnotations]);

  // Load annotations
  const loadAnnotations = useCallback(async () => {
    if (!filePath) return;

    isLoadingRef.current = true;
    try {
      const json = await invoke<string | null>("load_annotations", {
        pdfPath: filePath,
      });

      if (json) {
        const data: SerializedAnnotations = JSON.parse(json);
        const map = deserializeAnnotations(data);

        // Update store with loaded annotations
        useAnnotationStore.setState({
          annotations: map,
          undoStack: [],
          redoStack: [],
        });
        lastSavedRef.current = json;
        console.log("Annotations loaded");
      } else {
        // Clear annotations for new file
        clearAnnotations();
        lastSavedRef.current = "";
      }
    } catch (error) {
      console.error("Failed to load annotations:", error);
      clearAnnotations();
    } finally {
      isLoadingRef.current = false;
    }
  }, [filePath, deserializeAnnotations, clearAnnotations]);

  // Load annotations when file changes
  useEffect(() => {
    if (filePath) {
      loadAnnotations();
    }
  }, [filePath, loadAnnotations]);

  // Auto-save with debounce
  useEffect(() => {
    if (!filePath || isLoadingRef.current) return;

    const timeoutId = setTimeout(() => {
      saveAnnotations();
    }, 1000); // Save 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [filePath, annotations, saveAnnotations]);

  return {
    saveAnnotations,
    loadAnnotations,
  };
}
