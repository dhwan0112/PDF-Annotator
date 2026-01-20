import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";

import { useMindMapStore, useAnnotationStore, useLibraryStore } from "../../stores";
import { useDrag } from "../../contexts";
import type { MindMapNode as MindMapNodeType, Annotation } from "../../types";
import type { DragData, AnnotationDragData } from "../../contexts";
import {
  Plus,
  ArrowLeft,
  PanelRightOpen,
  PanelRightClose,
  GitBranch,
  Maximize2,
} from "lucide-react";
import { AnnotationBrowser } from "./AnnotationBrowser";
import { MindMapNodeMemo, type MindMapNodeData } from "./MindMapNode";

interface MindMapCanvasProps {
  mindMapId: string;
  studyGroupId: string;
  onClose: () => void;
  onOpenDocument?: (filePath: string, pageNumber?: number) => void;
}

const NODE_COLORS = [
  "#fef3c7", "#fce7f3", "#dbeafe", "#d1fae5", "#e9d5ff",
  "#fed7aa", "#cffafe", "#fecaca", "#d9f99d", "#f5d0fe",
];

// Custom node types for React Flow
const nodeTypes: NodeTypes = {
  mindMapNode: MindMapNodeMemo,
};

// Dagre layout function
const getLayoutedElements = (
  nodes: Node<MindMapNodeData>[],
  edges: Edge[],
  direction: "TB" | "LR" = "LR"
): { nodes: Node<MindMapNodeData>[]; edges: Edge[] } => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 200;
  const nodeHeight = 100;

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 80,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Convert store data to React Flow format
function convertToReactFlowNodes(
  storeNodes: MindMapNodeType[],
  onEdit: (nodeId: string, title: string, content: string) => void,
  onDelete: (nodeId: string) => void,
  onOpenDocument?: (filePath: string, pageNumber?: number) => void
): Node<MindMapNodeData>[] {
  return storeNodes.map((node) => ({
    id: node.id,
    type: "mindMapNode",
    position: { x: node.x, y: node.y },
    data: {
      label: node.title,
      content: node.content,
      color: node.color,
      sourceType: node.sourceType,
      sourceId: node.sourceId,
      documentId: node.documentId,
      filePath: node.filePath,
      pageNumber: node.pageNumber,
      collapsed: node.collapsed,
      onEdit,
      onDelete,
      onOpenDocument,
    },
  }));
}

function convertToReactFlowEdges(
  storeEdges: { id: string; sourceNodeId: string; targetNodeId: string; label?: string; color: string; style: string }[]
): Edge[] {
  return storeEdges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label: edge.label,
    style: {
      stroke: edge.color,
      strokeDasharray: edge.style === "dashed" ? "8,4" : edge.style === "dotted" ? "2,2" : undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edge.color,
    },
    type: "smoothstep",
  }));
}

// Inner component that uses React Flow hooks
function MindMapCanvasInner({ mindMapId, studyGroupId, onClose, onOpenDocument }: MindMapCanvasProps) {
  const reactFlowInstance = useReactFlow();

  const {
    getMindMap,
    addNode,
    updateNode,
    deleteNode,
    moveNode,
    addEdge: addStoreEdge,
    deleteEdge: deleteStoreEdge,
    importAnnotationAsNode,
  } = useMindMapStore();

  const mindMap = getMindMap(mindMapId);
  const { annotations: allAnnotations, clearSelection } = useAnnotationStore();
  const { documents } = useLibraryStore();
  const { dragState, registerDropZone, unregisterDropZone } = useDrag();

  const [showAnnotationBrowser, setShowAnnotationBrowser] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Node callbacks
  const handleEditNode = useCallback(
    (nodeId: string, title: string, content: string) => {
      updateNode(mindMapId, nodeId, { title, content });
    },
    [mindMapId, updateNode]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      deleteNode(mindMapId, nodeId);
    },
    [mindMapId, deleteNode]
  );

  // Convert store data to React Flow format
  const initialNodes = useMemo(() => {
    if (!mindMap) return [];
    return convertToReactFlowNodes(
      mindMap.nodes,
      handleEditNode,
      handleDeleteNode,
      onOpenDocument
    );
  }, [mindMap, handleEditNode, handleDeleteNode, onOpenDocument]);

  const initialEdges = useMemo(() => {
    if (!mindMap) return [];
    return convertToReactFlowEdges(mindMap.edges);
  }, [mindMap]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<MindMapNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes/edges when store changes
  useEffect(() => {
    if (mindMap) {
      setNodes(
        convertToReactFlowNodes(
          mindMap.nodes,
          handleEditNode,
          handleDeleteNode,
          onOpenDocument
        )
      );
      setEdges(convertToReactFlowEdges(mindMap.edges));
    }
  }, [mindMap, handleEditNode, handleDeleteNode, onOpenDocument, setNodes, setEdges]);

  // Handle connection (edge creation)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addStoreEdge(mindMapId, connection.source, connection.target);
      }
    },
    [mindMapId, addStoreEdge]
  );

  // Handle node drag end - update store
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      moveNode(mindMapId, node.id, node.position.x, node.position.y);
    },
    [mindMapId, moveNode]
  );

  // Handle edge delete
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((edge) => {
        deleteStoreEdge(mindMapId, edge.id);
      });
    },
    [mindMapId, deleteStoreEdge]
  );

  // Handle nodes delete
  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      deletedNodes.forEach((node) => {
        deleteNode(mindMapId, node.id);
      });
    },
    [mindMapId, deleteNode]
  );

  // Add new node
  const handleAddNode = useCallback(() => {
    const viewportCenter = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    addNode(mindMapId, {
      sourceType: "custom",
      x: viewportCenter.x,
      y: viewportCenter.y,
      title: "New Node",
      content: "",
      color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
      width: 200,
      height: 100,
      collapsed: false,
    });
  }, [mindMapId, addNode, reactFlowInstance]);

  // Auto-layout
  const handleAutoLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      "LR"
    );

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);

    // Update store with new positions
    layoutedNodes.forEach((node) => {
      moveNode(mindMapId, node.id, node.position.x, node.position.y);
    });

    // Fit view after layout
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 50);
  }, [nodes, edges, mindMapId, moveNode, reactFlowInstance, setNodes, setEdges]);

  // Reset view
  const handleResetView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  // Handle adding annotation to mind map
  const handleAddAnnotationToMindMap = useCallback(
    (annotation: Annotation, documentId: string, documentName: string) => {
      const viewportCenter = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      let title = "";
      let content = "";

      switch (annotation.type) {
        case "highlight":
        case "underline":
        case "strikeout":
          title = (annotation as { text?: string }).text?.slice(0, 50) || "Highlighted text";
          content = (annotation as { text?: string }).text || "";
          break;
        case "note":
          title = "Note";
          content = (annotation as { content: string }).content || "";
          break;
        case "textbox":
          title = "Text Box";
          content = (annotation as { content: string }).content || "";
          break;
        case "ink":
          title = "Drawing";
          content = `${(annotation as { strokes: unknown[] }).strokes.length} stroke(s) from ${documentName}`;
          break;
        case "highlighterInk":
          title = "Highlighter Mark";
          content = `Highlighter drawing from ${documentName}`;
          break;
        case "rect":
          title = "Rectangle";
          content = `Rectangle annotation from ${documentName}`;
          break;
        case "arrow":
          title = "Arrow";
          content = `Arrow annotation from ${documentName}`;
          break;
        default:
          title = "Annotation";
          content = `From ${documentName}`;
      }

      content += `\n\nPage ${annotation.pageNumber}`;

      importAnnotationAsNode(
        mindMapId,
        annotation.id,
        documentId,
        title,
        content,
        annotation.color || NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
        viewportCenter.x,
        viewportCenter.y
      );
    },
    [mindMapId, importAnnotationAsNode, reactFlowInstance]
  );

  // Handle drop from drag context
  const handleAnnotationDrop = useCallback(
    (data: DragData) => {
      if (!data || data.type !== "annotation") return;

      const annotationData = data as AnnotationDragData;
      const { annotationIds, documentId, filePath } = annotationData;
      if (!annotationIds || !Array.isArray(annotationIds)) return;

      const dropPosition = reactFlowInstance.screenToFlowPosition({
        x: dragState.position.x,
        y: dragState.position.y,
      });

      const doc = documents.find((d) => d.id === documentId || d.file_path === filePath);
      const documentName = doc?.title || doc?.file_name || "Unknown Document";

      annotationIds.forEach((annotationId: string, index: number) => {
        let foundAnnotation: Annotation | undefined;
        for (const [, pageAnnotations] of allAnnotations) {
          const found = pageAnnotations.find((a) => a.id === annotationId);
          if (found) {
            foundAnnotation = found;
            break;
          }
        }

        if (foundAnnotation) {
          let title = "";
          let content = "";

          switch (foundAnnotation.type) {
            case "highlight":
            case "underline":
            case "strikeout":
              title = (foundAnnotation as { text?: string }).text?.slice(0, 50) || "Text Annotation";
              content = (foundAnnotation as { text?: string }).text || "";
              break;
            case "note":
              title = (foundAnnotation as { content: string }).content.slice(0, 50);
              content = (foundAnnotation as { content: string }).content;
              break;
            case "textbox":
              title = (foundAnnotation as { content: string }).content.slice(0, 50);
              content = (foundAnnotation as { content: string }).content;
              break;
            case "ink":
              title = "Drawing";
              content = `Drawing annotation from ${documentName}`;
              break;
            case "highlighterInk":
              title = "Highlighter Mark";
              content = `Highlighter from ${documentName}`;
              break;
            case "rect":
              title = "Rectangle";
              content = `Rectangle annotation from ${documentName}`;
              break;
            case "arrow":
              title = "Arrow";
              content = `Arrow annotation from ${documentName}`;
              break;
            default:
              title = "Annotation";
              content = `From ${documentName}`;
          }

          content += `\n\nPage ${foundAnnotation.pageNumber}`;

          importAnnotationAsNode(
            mindMapId,
            foundAnnotation.id,
            documentId || "",
            title,
            content,
            foundAnnotation.color || NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
            dropPosition.x + index * 220,
            dropPosition.y + index * 30,
            filePath || undefined,
            foundAnnotation.pageNumber
          );
        }
      });

      clearSelection();
    },
    [
      mindMapId,
      allAnnotations,
      documents,
      importAnnotationAsNode,
      dragState.position,
      clearSelection,
      reactFlowInstance,
    ]
  );

  // Register drop zone
  useEffect(() => {
    const container = document.getElementById(`mindmap-container-${mindMapId}`);
    if (container) {
      registerDropZone(`mindmap-${mindMapId}`, container, handleAnnotationDrop);
      return () => unregisterDropZone(`mindmap-${mindMapId}`);
    }
  }, [mindMapId, registerDropZone, unregisterDropZone, handleAnnotationDrop]);

  // Track drag over state
  useEffect(() => {
    if (dragState.isDragging && dragState.dragData?.type === "annotation") {
      const container = document.getElementById(`mindmap-container-${mindMapId}`);
      if (container) {
        const rect = container.getBoundingClientRect();
        const { x, y } = dragState.position;
        const isOver = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        setIsDragOver(isOver);
      }
    } else {
      setIsDragOver(false);
    }
  }, [dragState, mindMapId]);

  // Handle native drag and drop
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const data = e.dataTransfer.getData("application/json");
      if (!data) return;

      try {
        const { annotationIds, documentId, filePath } = JSON.parse(data);
        if (!annotationIds || !Array.isArray(annotationIds)) return;

        const dropPosition = reactFlowInstance.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });

        const doc = documents.find((d) => d.id === documentId || d.file_path === filePath);
        const documentName = doc?.title || doc?.file_name || "Unknown Document";

        annotationIds.forEach((annotationId: string, index: number) => {
          let foundAnnotation: Annotation | undefined;
          for (const [, pageAnnotations] of allAnnotations) {
            const found = pageAnnotations.find((a) => a.id === annotationId);
            if (found) {
              foundAnnotation = found;
              break;
            }
          }

          if (foundAnnotation) {
            let title = "";
            let content = "";

            switch (foundAnnotation.type) {
              case "highlight":
              case "underline":
              case "strikeout":
                title = (foundAnnotation as { text?: string }).text?.slice(0, 50) || "Text Annotation";
                content = (foundAnnotation as { text?: string }).text || "";
                break;
              case "note":
                title = (foundAnnotation as { content: string }).content.slice(0, 50);
                content = (foundAnnotation as { content: string }).content;
                break;
              case "textbox":
                title = (foundAnnotation as { content: string }).content.slice(0, 50);
                content = (foundAnnotation as { content: string }).content;
                break;
              case "ink":
                title = "Drawing";
                content = `Drawing annotation from ${documentName}`;
                break;
              case "highlighterInk":
                title = "Highlighter Mark";
                content = `Highlighter from ${documentName}`;
                break;
              case "rect":
                title = "Rectangle";
                content = `Rectangle annotation from ${documentName}`;
                break;
              case "arrow":
                title = "Arrow";
                content = `Arrow annotation from ${documentName}`;
                break;
              default:
                title = "Annotation";
                content = `From ${documentName}`;
            }

            content += `\n\nPage ${foundAnnotation.pageNumber}`;

            importAnnotationAsNode(
              mindMapId,
              foundAnnotation.id,
              documentId || "",
              title,
              content,
              foundAnnotation.color || NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
              dropPosition.x + index * 220,
              dropPosition.y + index * 30,
              filePath || undefined,
              foundAnnotation.pageNumber
            );
          }
        });
      } catch (err) {
        console.error("Failed to parse dropped data:", err);
      }
    },
    [mindMapId, allAnnotations, documents, importAnnotationAsNode, reactFlowInstance]
  );

  if (!mindMap) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-500">Mind map not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-gray-100 dark:bg-gray-900 h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 gap-2">
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1">
            {mindMap.name}
          </h2>
          <button
            onClick={handleAddNode}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Add node"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleAutoLayout}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Auto layout"
          >
            <GitBranch className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Fit view"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAnnotationBrowser(!showAnnotationBrowser)}
            className={`p-2 rounded ${
              showAnnotationBrowser
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}
            title="Import from annotations"
          >
            {showAnnotationBrowser ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* React Flow Canvas */}
        <div
          id={`mindmap-container-${mindMapId}`}
          className={`flex-1 ${isDragOver ? "ring-4 ring-inset ring-blue-400" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onEdgesDelete={onEdgesDelete}
            onNodesDelete={onNodesDelete}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            deleteKeyCode={["Backspace", "Delete"]}
            defaultEdgeOptions={{
              type: "smoothstep",
              markerEnd: {
                type: MarkerType.ArrowClosed,
              },
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#aaa" gap={16} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(node) => {
                const data = node.data as MindMapNodeData;
                return data?.color || "#ddd";
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
              className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700"
            />

            {/* Empty state */}
            {nodes.length === 0 && (
              <Panel position="top-center" className="mt-20">
                <div className="text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <p className="mb-2 font-medium">Empty mind map</p>
                  <p className="text-sm mb-4">Add nodes manually or import from annotations</p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleAddNode}
                      className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Add node
                    </button>
                    <button
                      onClick={() => setShowAnnotationBrowser(true)}
                      className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Import annotations
                    </button>
                  </div>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Annotation Browser Sidebar */}
      {showAnnotationBrowser && (
        <AnnotationBrowser
          studyGroupId={studyGroupId}
          onAddToMindMap={handleAddAnnotationToMindMap}
          onClose={() => setShowAnnotationBrowser(false)}
        />
      )}
    </div>
  );
}

// Wrapper component with ReactFlowProvider
export function MindMapCanvas(props: MindMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <MindMapCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
