import { useState } from "react";
import { useStudyGroupStore, useLibraryStore, useMindMapStore } from "../../stores";
import type { StudyGroup } from "../../types";
import {
  FolderPlus,
  Folder,
  FolderOpen,
  Trash2,
  Edit2,
  Plus,
  FileText,
  Network,
  ChevronDown,
  ChevronRight,
  X,
  Check,
} from "lucide-react";

interface StudyGroupSidebarProps {
  onOpenDocument?: (docPath: string) => void;
  onOpenMindMap?: (mindMapId: string) => void;
}

const GROUP_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
];

export function StudyGroupSidebar({ onOpenDocument, onOpenMindMap }: StudyGroupSidebarProps) {
  const {
    studyGroups,
    activeStudyGroupId,
    createStudyGroup,
    updateStudyGroup,
    deleteStudyGroup,
    setActiveStudyGroup,
    addDocumentToGroup,
    removeDocumentFromGroup,
  } = useStudyGroupStore();
  const { documents } = useLibraryStore();
  const { getMindMapsForGroup, createMindMap } = useMindMapStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedColor, setSelectedColor] = useState(GROUP_COLORS[0]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showDocPicker, setShowDocPicker] = useState<string | null>(null);

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const id = createStudyGroup(newGroupName, undefined, selectedColor);
    setNewGroupName("");
    setIsCreating(false);
    setActiveStudyGroup(id);
    setExpandedGroups(new Set([...expandedGroups, id]));
  };

  const handleStartEdit = (group: StudyGroup) => {
    setEditingGroupId(group.id);
    setEditName(group.name);
  };

  const handleSaveEdit = () => {
    if (editingGroupId && editName.trim()) {
      updateStudyGroup(editingGroupId, { name: editName });
      setEditingGroupId(null);
      setEditName("");
    }
  };

  const toggleExpand = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleAddDocument = (groupId: string, docId: string) => {
    addDocumentToGroup(groupId, docId);
    setShowDocPicker(null);
  };

  const handleCreateMindMap = (groupId: string) => {
    const group = studyGroups.find((g) => g.id === groupId);
    const id = createMindMap(groupId, `${group?.name || "Study"} Mind Map`);
    if (onOpenMindMap) {
      onOpenMindMap(id);
    }
  };

  const getDocumentById = (docId: string) => {
    return documents.find((d) => d.id === docId);
  };

  return (
    <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Study Groups
        </h3>
        <button
          onClick={() => setIsCreating(true)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title="New group"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Create new group form */}
      {isCreating && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name..."
            className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateGroup();
              if (e.key === "Escape") setIsCreating(false);
            }}
          />
          {/* Color picker */}
          <div className="flex items-center gap-1 mt-2">
            {GROUP_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-5 h-5 rounded-full border-2 ${
                  selectedColor === color
                    ? "border-white ring-2 ring-blue-500"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex justify-end gap-1 mt-2">
            <button
              onClick={() => setIsCreating(false)}
              className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim()}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto">
        {studyGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.id);
          const isActive = activeStudyGroupId === group.id;
          const mindMaps = getMindMapsForGroup(group.id);
          const groupDocs = group.documentIds
            .map((id) => getDocumentById(id))
            .filter(Boolean);

          return (
            <div key={group.id} className="border-b border-gray-100 dark:border-gray-700">
              {/* Group header */}
              <div
                className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 ${
                  isActive ? "bg-blue-50 dark:bg-blue-900/20" : ""
                }`}
                onClick={() => {
                  setActiveStudyGroup(group.id);
                  toggleExpand(group.id);
                }}
              >
                <button className="p-0.5 mr-1">
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-gray-500" />
                  )}
                </button>
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 mr-2" style={{ color: group.color }} />
                ) : (
                  <Folder className="w-4 h-4 mr-2" style={{ color: group.color }} />
                )}
                {editingGroupId === group.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-1 text-sm bg-white dark:bg-gray-900 border border-blue-500 rounded focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit();
                      if (e.key === "Escape") setEditingGroupId(null);
                    }}
                  />
                ) : (
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                    {group.name}
                  </span>
                )}
                <span className="text-xs text-gray-400 mr-2">
                  {group.documentIds.length}
                </span>
                {editingGroupId === group.id ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveEdit();
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <Check className="w-3 h-3 text-green-600" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(group);
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100"
                  >
                    <Edit2 className="w-3 h-3 text-gray-500" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this group?")) {
                      deleteStudyGroup(group.id);
                    }
                  }}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="bg-gray-50 dark:bg-gray-850">
                  {/* Documents in group */}
                  {groupDocs.map((doc) => (
                    <div
                      key={doc!.id}
                      className="flex items-center px-8 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group"
                      onClick={() => onOpenDocument?.(doc!.file_path)}
                    >
                      <FileText className="w-3 h-3 mr-2 text-gray-400" />
                      <span className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                        {doc!.title || doc!.file_name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDocumentFromGroup(group.id, doc!.id);
                        }}
                        className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  ))}

                  {/* Mind maps */}
                  {mindMaps.map((mm) => (
                    <div
                      key={mm.id}
                      className="flex items-center px-8 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                      onClick={() => onOpenMindMap?.(mm.id)}
                    >
                      <Network className="w-3 h-3 mr-2 text-purple-500" />
                      <span className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                        {mm.name}
                      </span>
                    </div>
                  ))}

                  {/* Actions */}
                  <div className="flex px-6 py-2 gap-2">
                    <button
                      onClick={() => setShowDocPicker(group.id)}
                      className="flex items-center px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Doc
                    </button>
                    <button
                      onClick={() => handleCreateMindMap(group.id)}
                      className="flex items-center px-2 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded"
                    >
                      <Network className="w-3 h-3 mr-1" />
                      Mind Map
                    </button>
                  </div>

                  {/* Document picker */}
                  {showDocPicker === group.id && (
                    <div className="px-4 pb-2">
                      <div className="p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 max-h-40 overflow-y-auto">
                        {documents
                          .filter((d) => !group.documentIds.includes(d.id))
                          .map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                              onClick={() => handleAddDocument(group.id, doc.id)}
                            >
                              <FileText className="w-3 h-3 mr-2 text-gray-400" />
                              <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                {doc.title || doc.file_name}
                              </span>
                            </div>
                          ))}
                        {documents.filter((d) => !group.documentIds.includes(d.id))
                          .length === 0 && (
                          <div className="text-xs text-gray-400 text-center py-2">
                            No documents available
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setShowDocPicker(null)}
                        className="mt-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {studyGroups.length === 0 && !isCreating && (
          <div className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">
            No study groups yet.
            <br />
            Create one to organize your PDFs.
          </div>
        )}
      </div>
    </div>
  );
}
