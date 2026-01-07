import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

// Types for drag data
export interface TabDragData {
  type: "tab";
  tabId: string;
}

export interface AnnotationDragData {
  type: "annotation";
  annotationIds: string[];
  documentId: string | null;
  filePath: string | null;
}

export type DragData = TabDragData | AnnotationDragData | null;

interface DragState {
  isDragging: boolean;
  dragData: DragData;
  position: { x: number; y: number };
  startPosition: { x: number; y: number };
}

interface DragContextType {
  dragState: DragState;
  startDrag: (data: DragData, startX: number, startY: number) => void;
  updateDrag: (x: number, y: number) => void;
  endDrag: () => DragData;
  cancelDrag: () => void;
  registerDropZone: (id: string, element: HTMLElement, onDrop: (data: DragData) => void) => void;
  unregisterDropZone: (id: string) => void;
}

const DragContext = createContext<DragContextType | null>(null);

export function useDrag() {
  const context = useContext(DragContext);
  if (!context) {
    throw new Error("useDrag must be used within a DragProvider");
  }
  return context;
}

interface DropZone {
  element: HTMLElement;
  onDrop: (data: DragData) => void;
}

export function DragProvider({ children }: { children: React.ReactNode }) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragData: null,
    position: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 },
  });

  const dropZonesRef = useRef<Map<string, DropZone>>(new Map());
  const dragDataRef = useRef<DragData>(null);

  const startDrag = useCallback((data: DragData, startX: number, startY: number) => {
    dragDataRef.current = data;
    setDragState({
      isDragging: true,
      dragData: data,
      position: { x: startX, y: startY },
      startPosition: { x: startX, y: startY },
    });
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }, []);

  const updateDrag = useCallback((x: number, y: number) => {
    setDragState((prev) => ({
      ...prev,
      position: { x, y },
    }));
  }, []);

  const findDropZoneAtPosition = useCallback((x: number, y: number): DropZone | null => {
    for (const [, zone] of dropZonesRef.current) {
      const rect = zone.element.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return zone;
      }
    }
    return null;
  }, []);

  const endDrag = useCallback((): DragData => {
    const data = dragDataRef.current;
    const { position } = dragState;

    // Find drop zone at current position
    const dropZone = findDropZoneAtPosition(position.x, position.y);
    if (dropZone && data) {
      dropZone.onDrop(data);
    }

    dragDataRef.current = null;
    setDragState({
      isDragging: false,
      dragData: null,
      position: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 },
    });
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    return data;
  }, [dragState, findDropZoneAtPosition]);

  const cancelDrag = useCallback(() => {
    dragDataRef.current = null;
    setDragState({
      isDragging: false,
      dragData: null,
      position: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 },
    });
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const registerDropZone = useCallback((id: string, element: HTMLElement, onDrop: (data: DragData) => void) => {
    dropZonesRef.current.set(id, { element, onDrop });
  }, []);

  const unregisterDropZone = useCallback((id: string) => {
    dropZonesRef.current.delete(id);
  }, []);

  // Global mouse event handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.isDragging) {
        updateDrag(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (dragState.isDragging) {
        // Update position one last time
        setDragState((prev) => ({
          ...prev,
          position: { x: e.clientX, y: e.clientY },
        }));
        // Use setTimeout to ensure state is updated before endDrag
        setTimeout(() => {
          const data = dragDataRef.current;
          const dropZone = findDropZoneAtPosition(e.clientX, e.clientY);
          if (dropZone && data) {
            dropZone.onDrop(data);
          }
          cancelDrag();
        }, 0);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragState.isDragging) {
        cancelDrag();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dragState.isDragging, updateDrag, cancelDrag, findDropZoneAtPosition]);

  return (
    <DragContext.Provider
      value={{
        dragState,
        startDrag,
        updateDrag,
        endDrag,
        cancelDrag,
        registerDropZone,
        unregisterDropZone,
      }}
    >
      {children}
      {/* Drag ghost/indicator */}
      {dragState.isDragging && dragState.dragData && (
        <div
          className="fixed pointer-events-none z-[9999] px-3 py-2 bg-blue-600 text-white rounded-lg shadow-xl opacity-90 text-sm font-medium"
          style={{
            left: dragState.position.x + 10,
            top: dragState.position.y + 10,
          }}
        >
          {dragState.dragData.type === "tab" && "📄 탭 이동 중..."}
          {dragState.dragData.type === "annotation" && `📝 ${dragState.dragData.annotationIds.length}개 어노테이션`}
        </div>
      )}
    </DragContext.Provider>
  );
}
