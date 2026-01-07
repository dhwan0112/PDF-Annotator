import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MindMap, MindMapNode, MindMapEdge } from "../types";

interface MindMapState {
  // Mind Maps (indexed by studyGroupId)
  mindMaps: Map<string, MindMap[]>;
  activeMindMapId: string | null;

  // Mind Map Actions
  createMindMap: (studyGroupId: string, name: string) => string;
  updateMindMap: (id: string, updates: Partial<Omit<MindMap, "id" | "createdAt" | "studyGroupId">>) => void;
  deleteMindMap: (id: string) => void;
  setActiveMindMap: (id: string | null) => void;
  getMindMap: (id: string) => MindMap | undefined;
  getMindMapsForGroup: (studyGroupId: string) => MindMap[];

  // Node Actions
  addNode: (mindMapId: string, node: Omit<MindMapNode, "id" | "createdAt" | "updatedAt">) => string;
  updateNode: (mindMapId: string, nodeId: string, updates: Partial<Omit<MindMapNode, "id" | "createdAt">>) => void;
  deleteNode: (mindMapId: string, nodeId: string) => void;
  moveNode: (mindMapId: string, nodeId: string, x: number, y: number) => void;

  // Edge Actions
  addEdge: (mindMapId: string, sourceNodeId: string, targetNodeId: string, label?: string) => string;
  updateEdge: (mindMapId: string, edgeId: string, updates: Partial<Omit<MindMapEdge, "id">>) => void;
  deleteEdge: (mindMapId: string, edgeId: string) => void;

  // Canvas Actions
  setCanvasZoom: (mindMapId: string, zoom: number) => void;
  setCanvasPan: (mindMapId: string, panX: number, panY: number) => void;

  // Import from notes
  importMarginNoteAsNode: (
    mindMapId: string,
    marginNoteId: string,
    documentId: string,
    title: string,
    content: string,
    color: string,
    x: number,
    y: number
  ) => string;
  importAnnotationAsNode: (
    mindMapId: string,
    annotationId: string,
    documentId: string,
    title: string,
    content: string,
    color: string,
    x: number,
    y: number,
    filePath?: string,
    pageNumber?: number
  ) => string;
}

const NODE_COLORS = [
  "#fef3c7", "#fce7f3", "#dbeafe", "#d1fae5", "#e9d5ff",
  "#fed7aa", "#cffafe", "#fecaca", "#d9f99d", "#f5d0fe",
];

export const useMindMapStore = create<MindMapState>()(
  persist(
    (set, get) => ({
      mindMaps: new Map(),
      activeMindMapId: null,

      // Mind Map Actions
      createMindMap: (studyGroupId, name) => {
        const id = crypto.randomUUID();
        const newMindMap: MindMap = {
          id,
          studyGroupId,
          name,
          nodes: [],
          edges: [],
          zoom: 1,
          panX: 0,
          panY: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => {
          const newMap = new Map(state.mindMaps);
          const groupMaps = newMap.get(studyGroupId) || [];
          newMap.set(studyGroupId, [...groupMaps, newMindMap]);
          return { mindMaps: newMap };
        });
        return id;
      },

      updateMindMap: (id, updates) => {
        set((state) => {
          const newMap = new Map(state.mindMaps);
          for (const [groupId, maps] of newMap) {
            const index = maps.findIndex((m) => m.id === id);
            if (index !== -1) {
              const updatedMaps = [...maps];
              updatedMaps[index] = { ...updatedMaps[index], ...updates, updatedAt: new Date() };
              newMap.set(groupId, updatedMaps);
              break;
            }
          }
          return { mindMaps: newMap };
        });
      },

      deleteMindMap: (id) => {
        set((state) => {
          const newMap = new Map(state.mindMaps);
          for (const [groupId, maps] of newMap) {
            const filtered = maps.filter((m) => m.id !== id);
            if (filtered.length !== maps.length) {
              newMap.set(groupId, filtered);
              break;
            }
          }
          return {
            mindMaps: newMap,
            activeMindMapId: state.activeMindMapId === id ? null : state.activeMindMapId,
          };
        });
      },

      setActiveMindMap: (id) => {
        set({ activeMindMapId: id });
      },

      getMindMap: (id) => {
        for (const maps of get().mindMaps.values()) {
          const found = maps.find((m) => m.id === id);
          if (found) return found;
        }
        return undefined;
      },

      getMindMapsForGroup: (studyGroupId) => {
        return get().mindMaps.get(studyGroupId) || [];
      },

      // Node Actions
      addNode: (mindMapId, nodeData) => {
        const nodeId = crypto.randomUUID();
        const node: MindMapNode = {
          ...nodeData,
          id: nodeId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => {
          const newMap = new Map(state.mindMaps);
          for (const [groupId, maps] of newMap) {
            const index = maps.findIndex((m) => m.id === mindMapId);
            if (index !== -1) {
              const updatedMaps = [...maps];
              updatedMaps[index] = {
                ...updatedMaps[index],
                nodes: [...updatedMaps[index].nodes, node],
                updatedAt: new Date(),
              };
              newMap.set(groupId, updatedMaps);
              break;
            }
          }
          return { mindMaps: newMap };
        });
        return nodeId;
      },

      updateNode: (mindMapId, nodeId, updates) => {
        set((state) => {
          const newMap = new Map(state.mindMaps);
          for (const [groupId, maps] of newMap) {
            const mapIndex = maps.findIndex((m) => m.id === mindMapId);
            if (mapIndex !== -1) {
              const mindMap = maps[mapIndex];
              const nodeIndex = mindMap.nodes.findIndex((n) => n.id === nodeId);
              if (nodeIndex !== -1) {
                const updatedNodes = [...mindMap.nodes];
                updatedNodes[nodeIndex] = {
                  ...updatedNodes[nodeIndex],
                  ...updates,
                  updatedAt: new Date(),
                };
                const updatedMaps = [...maps];
                updatedMaps[mapIndex] = {
                  ...mindMap,
                  nodes: updatedNodes,
                  updatedAt: new Date(),
                };
                newMap.set(groupId, updatedMaps);
              }
              break;
            }
          }
          return { mindMaps: newMap };
        });
      },

      deleteNode: (mindMapId, nodeId) => {
        set((state) => {
          const newMap = new Map(state.mindMaps);
          for (const [groupId, maps] of newMap) {
            const mapIndex = maps.findIndex((m) => m.id === mindMapId);
            if (mapIndex !== -1) {
              const mindMap = maps[mapIndex];
              const updatedMaps = [...maps];
              updatedMaps[mapIndex] = {
                ...mindMap,
                nodes: mindMap.nodes.filter((n) => n.id !== nodeId),
                edges: mindMap.edges.filter(
                  (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
                ),
                updatedAt: new Date(),
              };
              newMap.set(groupId, updatedMaps);
              break;
            }
          }
          return { mindMaps: newMap };
        });
      },

      moveNode: (mindMapId, nodeId, x, y) => {
        get().updateNode(mindMapId, nodeId, { x, y });
      },

      // Edge Actions
      addEdge: (mindMapId, sourceNodeId, targetNodeId, label) => {
        const edgeId = crypto.randomUUID();
        const edge: MindMapEdge = {
          id: edgeId,
          sourceNodeId,
          targetNodeId,
          label,
          color: "#6b7280",
          style: "solid",
        };
        set((state) => {
          const newMap = new Map(state.mindMaps);
          for (const [groupId, maps] of newMap) {
            const index = maps.findIndex((m) => m.id === mindMapId);
            if (index !== -1) {
              const updatedMaps = [...maps];
              updatedMaps[index] = {
                ...updatedMaps[index],
                edges: [...updatedMaps[index].edges, edge],
                updatedAt: new Date(),
              };
              newMap.set(groupId, updatedMaps);
              break;
            }
          }
          return { mindMaps: newMap };
        });
        return edgeId;
      },

      updateEdge: (mindMapId, edgeId, updates) => {
        set((state) => {
          const newMap = new Map(state.mindMaps);
          for (const [groupId, maps] of newMap) {
            const mapIndex = maps.findIndex((m) => m.id === mindMapId);
            if (mapIndex !== -1) {
              const mindMap = maps[mapIndex];
              const edgeIndex = mindMap.edges.findIndex((e) => e.id === edgeId);
              if (edgeIndex !== -1) {
                const updatedEdges = [...mindMap.edges];
                updatedEdges[edgeIndex] = { ...updatedEdges[edgeIndex], ...updates };
                const updatedMaps = [...maps];
                updatedMaps[mapIndex] = {
                  ...mindMap,
                  edges: updatedEdges,
                  updatedAt: new Date(),
                };
                newMap.set(groupId, updatedMaps);
              }
              break;
            }
          }
          return { mindMaps: newMap };
        });
      },

      deleteEdge: (mindMapId, edgeId) => {
        set((state) => {
          const newMap = new Map(state.mindMaps);
          for (const [groupId, maps] of newMap) {
            const mapIndex = maps.findIndex((m) => m.id === mindMapId);
            if (mapIndex !== -1) {
              const mindMap = maps[mapIndex];
              const updatedMaps = [...maps];
              updatedMaps[mapIndex] = {
                ...mindMap,
                edges: mindMap.edges.filter((e) => e.id !== edgeId),
                updatedAt: new Date(),
              };
              newMap.set(groupId, updatedMaps);
              break;
            }
          }
          return { mindMaps: newMap };
        });
      },

      // Canvas Actions
      setCanvasZoom: (mindMapId, zoom) => {
        get().updateMindMap(mindMapId, { zoom: Math.max(0.25, Math.min(2, zoom)) });
      },

      setCanvasPan: (mindMapId, panX, panY) => {
        get().updateMindMap(mindMapId, { panX, panY });
      },

      // Import helpers
      importMarginNoteAsNode: (mindMapId, marginNoteId, documentId, title, content, color, x, y) => {
        return get().addNode(mindMapId, {
          sourceType: "margin_note",
          sourceId: marginNoteId,
          documentId,
          x,
          y,
          title,
          content,
          color: color || NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
          width: 200,
          height: 100,
          collapsed: false,
        });
      },

      importAnnotationAsNode: (mindMapId, annotationId, documentId, title, content, color, x, y, filePath, pageNumber) => {
        return get().addNode(mindMapId, {
          sourceType: "annotation",
          sourceId: annotationId,
          documentId,
          filePath,
          pageNumber,
          x,
          y,
          title,
          content,
          color: color || NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
          width: 200,
          height: 100,
          collapsed: false,
        });
      },
    }),
    {
      name: "marginalia-mind-maps",
      partialize: (state) => ({
        mindMaps: Array.from(state.mindMaps.entries()),
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as {
          mindMaps?: [string, MindMap[]][];
        };
        return {
          ...current,
          mindMaps: new Map(persistedState.mindMaps || []),
        };
      },
    }
  )
);
