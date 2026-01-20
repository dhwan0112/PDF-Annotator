import { memo, useState, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Edit2, X, FileText, Trash2 } from "lucide-react";

export interface MindMapNodeData extends Record<string, unknown> {
  label: string;
  content?: string;
  color: string;
  sourceType: "margin_note" | "annotation" | "custom";
  sourceId?: string;
  documentId?: string;
  filePath?: string;
  pageNumber?: number;
  collapsed: boolean;
  onEdit?: (nodeId: string, title: string, content: string) => void;
  onDelete?: (nodeId: string) => void;
  onOpenDocument?: (filePath: string, pageNumber?: number) => void;
}

export type MindMapNodeType = Node<MindMapNodeData, "mindMapNode">;

function MindMapNodeComponent({ id, data, selected }: NodeProps<MindMapNodeType>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(data.label);
  const [editContent, setEditContent] = useState(data.content || "");

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(data.label);
    setEditContent(data.content || "");
    setIsEditing(true);
  }, [data.label, data.content]);

  const handleSaveEdit = useCallback(() => {
    if (data.onEdit) {
      data.onEdit(id, editTitle, editContent);
    }
    setIsEditing(false);
  }, [id, editTitle, editContent, data]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditTitle(data.label);
    setEditContent(data.content || "");
  }, [data.label, data.content]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onDelete) {
      data.onDelete(id);
    }
  }, [id, data]);

  const handleOpenDocument = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onOpenDocument && data.filePath) {
      data.onOpenDocument(data.filePath, data.pageNumber);
    }
  }, [data]);

  return (
    <div
      className={`rounded-lg shadow-md border-2 overflow-hidden min-w-[180px] max-w-[280px] ${
        selected
          ? "border-blue-500 ring-2 ring-blue-300"
          : "border-gray-200 dark:border-gray-600"
      }`}
      style={{ backgroundColor: data.color }}
    >
      {/* Input handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-gray-400 hover:!bg-blue-500 transition-colors"
      />

      {/* Output handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-gray-400 hover:!bg-blue-500 transition-colors"
      />

      {isEditing ? (
        <div className="p-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full px-2 py-1 text-sm font-semibold bg-white/90 border border-gray-300 rounded mb-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSaveEdit();
              }
              if (e.key === "Escape") handleCancelEdit();
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-20 px-2 py-1 text-xs bg-white/90 border border-gray-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex justify-end gap-1 mt-1">
            <button
              onClick={handleCancelEdit}
              className="p-1 hover:bg-black/10 rounded text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="px-3 py-2 bg-black/5 flex items-center justify-between group">
            <span className="text-sm font-semibold text-gray-800 truncate flex-1">
              {data.label}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleStartEdit}
                className="p-1 hover:bg-black/10 rounded"
                title="Edit"
              >
                <Edit2 className="w-3 h-3 text-gray-600" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1 hover:bg-red-100 rounded"
                title="Delete"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          {data.content && (
            <div className="px-3 py-2">
              <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-4">
                {data.content}
              </p>
            </div>
          )}

          {/* Source info footer */}
          {data.sourceType !== "custom" && (
            <div className="px-3 py-1.5 text-xs text-gray-500 bg-black/5 flex items-center justify-between">
              <span>
                From {data.sourceType === "margin_note" ? "note" : "annotation"}
              </span>
              {data.filePath && data.onOpenDocument && (
                <button
                  onClick={handleOpenDocument}
                  className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-black/10 rounded text-blue-600"
                  title={`Go to page ${data.pageNumber || 1}`}
                >
                  <FileText className="w-3 h-3" />
                  <span className="text-[10px]">View</span>
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export const MindMapNodeMemo = memo(MindMapNodeComponent);
