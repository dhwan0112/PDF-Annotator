import { useRef, useState, useCallback, useEffect } from "react";
import { useMindMapStore, useAnnotationStore, useLibraryStore } from "../../stores";
import { useDrag } from "../../contexts";
import type { MindMapNode, Annotation } from "../../types";
import type { DragData, AnnotationDragData } from "../../contexts";
import {
  Plus,
  Trash2,
  Link,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ArrowLeft,
  Edit2,
  X,
  PanelRightOpen,
  PanelRightClose,
  FileText,
} from "lucide-react";
import { AnnotationBrowser } from "./AnnotationBrowser";

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

export function MindMapCanvas({ mindMapId, studyGroupId, onClose, onOpenDocument }: MindMapCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    getMindMap,
    addNode,
    updateNode,
    deleteNode,
    moveNode,
    addEdge,
    deleteEdge,
    setCanvasZoom,
    setCanvasPan,
    importAnnotationAsNode,
  } = useMindMapStore();

  const mindMap = getMindMap(mindMapId);

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [showAnnotationBrowser, setShowAnnotationBrowser] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Custom drag system
  const { dragState, registerDropZone, unregisterDropZone } = useDrag();

  // For getting annotation data when dropped
  const { annotations: allAnnotations, clearSelection } = useAnnotationStore();
  const { documents } = useLibraryStore();

  if (!mindMap) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-500">Mind map not found</p>
      </div>
    );
  }

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button === 0) {
      const node = mindMap.nodes.find((n) => n.id === nodeId);
      if (node) {
        setDraggingNodeId(nodeId);
        setDragOffset({
          x: e.clientX - node.x * mindMap.zoom - mindMap.panX,
          y: e.clientY - node.y * mindMap.zoom - mindMap.panY,
        });
        setSelectedNodeId(nodeId);
      }
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingNodeId && mindMap) {
        const newX = (e.clientX - dragOffset.x - mindMap.panX) / mindMap.zoom;
        const newY = (e.clientY - dragOffset.y - mindMap.panY) / mindMap.zoom;
        moveNode(mindMapId, draggingNodeId, newX, newY);
      } else if (isPanning && mindMap) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setCanvasPan(mindMapId, mindMap.panX + dx, mindMap.panY + dy);
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    },
    [draggingNodeId, dragOffset, isPanning, panStart, mindMap, mindMapId, moveNode, setCanvasPan]
  );

  const handleMouseUp = () => {
    setDraggingNodeId(null);
    setIsPanning(false);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setSelectedNodeId(null);
      setConnectingFromId(null);
    }
  };

  const handleNodeClick = (nodeId: string) => {
    if (connectingFromId && connectingFromId !== nodeId) {
      // Create edge
      addEdge(mindMapId, connectingFromId, nodeId);
      setConnectingFromId(null);
    } else {
      setSelectedNodeId(nodeId);
    }
  };

  const handleAddNode = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect && mindMap) {
      const x = (rect.width / 2 - mindMap.panX) / mindMap.zoom;
      const y = (rect.height / 2 - mindMap.panY) / mindMap.zoom;
      addNode(mindMapId, {
        sourceType: "custom",
        x,
        y,
        title: "New Node",
        content: "",
        color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
        width: 200,
        height: 100,
        collapsed: false,
      });
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    deleteNode(mindMapId, nodeId);
    setSelectedNodeId(null);
  };

  const handleStartEdit = (node: MindMapNode) => {
    setEditingNodeId(node.id);
    setEditTitle(node.title);
    setEditContent(node.content || "");
  };

  const handleSaveEdit = () => {
    if (editingNodeId) {
      updateNode(mindMapId, editingNodeId, {
        title: editTitle,
        content: editContent,
      });
      setEditingNodeId(null);
    }
  };

  const handleZoom = (delta: number) => {
    setCanvasZoom(mindMapId, mindMap.zoom + delta);
  };

  const handleResetView = () => {
    setCanvasZoom(mindMapId, 1);
    setCanvasPan(mindMapId, 0, 0);
  };

  const handleAddAnnotationToMindMap = (annotation: Annotation, documentId: string, documentName: string) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !mindMap) return;

    // Calculate position for new node (slightly offset from center or last added)
    const nodeCount = mindMap.nodes.length;
    const offsetX = (nodeCount % 5) * 50;
    const offsetY = Math.floor(nodeCount / 5) * 50;
    const x = (rect.width / 2 - mindMap.panX + offsetX) / mindMap.zoom;
    const y = (rect.height / 2 - mindMap.panY + offsetY) / mindMap.zoom;

    // Get content based on annotation type
    let title = "";
    let content = "";

    switch (annotation.type) {
      case "highlight":
      case "underline":
      case "strikeout":
        title = annotation.text?.slice(0, 50) || "Highlighted text";
        content = annotation.text || "";
        break;
      case "note":
        title = "Note";
        content = annotation.content || "";
        break;
      case "textbox":
        title = "Text Box";
        content = annotation.content || "";
        break;
      case "ink":
        title = "Drawing";
        content = `${annotation.strokes.length} stroke(s) from ${documentName}`;
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

    // Add page info to content
    content += `\n\nPage ${annotation.pageNumber}`;

    importAnnotationAsNode(
      mindMapId,
      annotation.id,
      documentId,
      title,
      content,
      annotation.color || NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
      x,
      y
    );
  };

  // Handle drag and drop from PDF viewer
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the actual canvas, not a child element
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const data = e.dataTransfer.getData("application/json");
    console.log("[MindMapCanvas] Drop received, data:", data);
    if (!data) return;

    try {
      const { annotationIds, documentId, filePath } = JSON.parse(data);
      if (!annotationIds || !Array.isArray(annotationIds)) return;

      // Get drop position in canvas coordinates
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !mindMap) return;

      const dropX = (e.clientX - rect.left - mindMap.panX) / mindMap.zoom;
      const dropY = (e.clientY - rect.top - mindMap.panY) / mindMap.zoom;

      // Get document name
      const doc = documents.find(d => d.id === documentId || d.file_path === filePath);
      const documentName = doc?.title || doc?.file_name || "Unknown Document";

      // Add each annotation as a node, offset each one
      annotationIds.forEach((annotationId: string, index: number) => {
        // Find the annotation in the store
        let foundAnnotation: Annotation | undefined;
        for (const [, pageAnnotations] of allAnnotations) {
          const found = pageAnnotations.find(a => a.id === annotationId);
          if (found) {
            foundAnnotation = found;
            break;
          }
        }

        if (foundAnnotation) {
          // Extract annotation info
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
            dropX + index * 220,
            dropY + index * 30,
            filePath || undefined,
            foundAnnotation.pageNumber
          );
        }
      });
    } catch (err) {
      console.error("Failed to parse dropped data:", err);
    }
  }, [mindMap, mindMapId, allAnnotations, documents, importAnnotationAsNode]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setCanvasZoom(mindMapId, mindMap.zoom + delta);
      }
    },
    [mindMapId, mindMap.zoom, setCanvasZoom]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("wheel", handleWheel, { passive: false });
      return () => canvas.removeEventListener("wheel", handleWheel);
    }
  }, [handleWheel]);

  // Custom drop handler for annotation drag
  const handleAnnotationDrop = useCallback((data: DragData) => {
    if (!data || data.type !== "annotation") return;
    if (!canvasRef.current || !mindMap) return;

    const annotationData = data as AnnotationDragData;
    const { annotationIds, documentId, filePath } = annotationData;
    if (!annotationIds || !Array.isArray(annotationIds)) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const dropX = (dragState.position.x - rect.left - mindMap.panX) / mindMap.zoom;
    const dropY = (dragState.position.y - rect.top - mindMap.panY) / mindMap.zoom;

    const doc = documents.find(d => d.id === documentId || d.file_path === filePath);
    const documentName = doc?.title || doc?.file_name || "Unknown Document";

    annotationIds.forEach((annotationId: string, index: number) => {
      let foundAnnotation: Annotation | undefined;
      for (const [, pageAnnotations] of allAnnotations) {
        const found = pageAnnotations.find(a => a.id === annotationId);
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
          dropX + index * 220,
          dropY + index * 30,
          filePath || undefined,
          foundAnnotation.pageNumber
        );
      }
    });

    // Clear the annotation selection after successful drop
    clearSelection();
  }, [mindMap, mindMapId, allAnnotations, documents, importAnnotationAsNode, dragState.position, clearSelection]);

  // Register as drop zone for annotations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      registerDropZone(`mindmap-${mindMapId}`, canvas, handleAnnotationDrop);
      return () => unregisterDropZone(`mindmap-${mindMapId}`);
    }
  }, [mindMapId, registerDropZone, unregisterDropZone, handleAnnotationDrop]);

  // Show visual feedback when annotation is being dragged over
  useEffect(() => {
    if (dragState.isDragging && dragState.dragData?.type === "annotation") {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const { x, y } = dragState.position;
        const isOver = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        setIsDragOver(isOver);
      }
    } else {
      setIsDragOver(false);
    }
  }, [dragState]);

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
            title="Add empty node"
          >
            <Plus className="w-4 h-4" />
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
        {selectedNodeId && (
          <>
            <button
              onClick={() => setConnectingFromId(selectedNodeId)}
              className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                connectingFromId === selectedNodeId
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                  : "text-gray-600 dark:text-gray-400"
              }`}
              title="Connect to another node"
            >
              <Link className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteNode(selectedNodeId)}
              className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
              title="Delete node"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          onClick={() => handleZoom(-0.1)}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-500 w-12 text-center">
          {Math.round(mindMap.zoom * 100)}%
        </span>
        <button
          onClick={() => handleZoom(0.1)}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title="Reset view"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing ${
          isDragOver ? "ring-4 ring-inset ring-blue-400 bg-blue-50 dark:bg-blue-900/20" : ""
        }`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Connecting line indicator */}
        {connectingFromId && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 text-white text-xs rounded-full z-10">
            Click another node to connect
          </div>
        )}

        {/* SVG for edges */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            transform: `translate(${mindMap.panX}px, ${mindMap.panY}px) scale(${mindMap.zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {mindMap.edges.map((edge) => {
            const sourceNode = mindMap.nodes.find((n) => n.id === edge.sourceNodeId);
            const targetNode = mindMap.nodes.find((n) => n.id === edge.targetNodeId);
            if (!sourceNode || !targetNode) return null;

            const sx = sourceNode.x + sourceNode.width / 2;
            const sy = sourceNode.y + sourceNode.height / 2;
            const tx = targetNode.x + targetNode.width / 2;
            const ty = targetNode.y + targetNode.height / 2;

            // Bezier curve control points
            const dx = tx - sx;
            const cx1 = sx + dx * 0.5;
            const cx2 = tx - dx * 0.5;

            return (
              <g key={edge.id}>
                <path
                  d={`M ${sx} ${sy} C ${cx1} ${sy}, ${cx2} ${ty}, ${tx} ${ty}`}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={2}
                  strokeDasharray={
                    edge.style === "dashed"
                      ? "8,4"
                      : edge.style === "dotted"
                        ? "2,2"
                        : undefined
                  }
                  className="pointer-events-auto cursor-pointer hover:stroke-red-500"
                  onClick={() => {
                    if (confirm("Delete this connection?")) {
                      deleteEdge(mindMapId, edge.id);
                    }
                  }}
                />
                {edge.label && (
                  <text
                    x={(sx + tx) / 2}
                    y={(sy + ty) / 2 - 8}
                    fontSize={12}
                    fill="#6b7280"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes - pointer-events-none on container so drag events reach canvas */}
        <div
          className="pointer-events-none"
          style={{
            transform: `translate(${mindMap.panX}px, ${mindMap.panY}px) scale(${mindMap.zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {mindMap.nodes.map((node) => (
            <div
              key={node.id}
              className={`absolute rounded-lg shadow-md border-2 overflow-hidden cursor-move select-none group pointer-events-auto ${
                selectedNodeId === node.id
                  ? "border-blue-500 ring-2 ring-blue-300"
                  : "border-gray-200 dark:border-gray-600"
              }`}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                minHeight: node.height,
                backgroundColor: node.color,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleMouseDown(e, node.id);
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleNodeClick(node.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleStartEdit(node);
              }}
            >
              {editingNodeId === node.id ? (
                <div className="p-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-1 py-0.5 text-sm font-semibold bg-white/80 border border-gray-300 rounded mb-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit();
                      if (e.key === "Escape") setEditingNodeId(null);
                    }}
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-16 px-1 py-0.5 text-xs bg-white/80 border border-gray-300 rounded resize-none"
                  />
                  <div className="flex justify-end gap-1 mt-1">
                    <button
                      onClick={() => setEditingNodeId(null)}
                      className="p-1 hover:bg-black/10 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="p-1 hover:bg-black/10 rounded text-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="px-3 py-2 bg-black/5 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800 truncate">
                      {node.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(node);
                      }}
                      className="p-0.5 hover:bg-black/10 rounded opacity-0 group-hover:opacity-100"
                    >
                      <Edit2 className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                  {node.content && (
                    <div className="px-3 py-2">
                      <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-4">
                        {node.content}
                      </p>
                    </div>
                  )}
                  {node.sourceType !== "custom" && (
                    <div className="px-3 py-1 text-xs text-gray-500 bg-black/5 flex items-center justify-between">
                      <span>From {node.sourceType === "margin_note" ? "note" : "annotation"}</span>
                      {node.filePath && onOpenDocument && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDocument(node.filePath!, node.pageNumber);
                          }}
                          className="p-1 hover:bg-black/10 rounded flex items-center gap-1 text-blue-600"
                          title={`Go to page ${node.pageNumber || 1}`}
                        >
                          <FileText className="w-3 h-3" />
                          <span className="text-[10px]">원본보기</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {mindMap.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400 dark:text-gray-500">
              <p className="mb-2">Empty mind map</p>
              <p className="text-xs mb-3">Add nodes manually or import from annotations</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleAddNode}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add node
                </button>
                <button
                  onClick={() => setShowAnnotationBrowser(true)}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Import annotations
                </button>
              </div>
            </div>
          </div>
        )}
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
