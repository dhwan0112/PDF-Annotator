import { useState } from "react";
import {
  FolderOpen,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Tag as TagIcon,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Folder,
  FileText,
  Network,
  X,
  Check,
  Edit2,
} from "lucide-react";
import type { Project, Tag } from "../../stores";
import { useStudyGroupStore, useLibraryStore, useMindMapStore } from "../../stores";
import type { StudyGroup } from "../../types";

interface ProjectSidebarProps {
  projects: Project[];
  tags: Tag[];
  selectedProjectId: string | null;
  selectedTagIds: string[];
  onSelectProject: (projectId: string | null) => void;
  onSelectTags: (tagIds: string[]) => void;
  onAddProject: (name: string) => void;
  onEditProject: (id: string, name: string, color: string) => void;
  onDeleteProject: (id: string) => void;
  onAddTag: (name: string, color: string) => void;
  onDeleteTag: (id: string) => void;
  onOpenDocument?: (docPath: string) => void;
  onOpenMindMap?: (mindMapId: string) => void;
}

const PROJECT_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
];

const GROUP_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
];

export function ProjectSidebar({
  projects,
  tags,
  selectedProjectId,
  selectedTagIds,
  onSelectProject,
  onSelectTags,
  onAddProject,
  onEditProject,
  onDeleteProject,
  onAddTag,
  onDeleteTag,
  onOpenDocument,
  onOpenMindMap,
}: ProjectSidebarProps) {
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PROJECT_COLORS[0]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);

  // Study Groups state
  const [studyGroupsExpanded, setStudyGroupsExpanded] = useState(true);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showDocPicker, setShowDocPicker] = useState<string | null>(null);

  // Study Groups store
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
  const libraryDocuments = useLibraryStore((s) => s.documents);
  const { getMindMapsForGroup, createMindMap } = useMindMapStore();

  const handleAddProject = () => {
    if (newProjectName.trim()) {
      onAddProject(newProjectName.trim());
      setNewProjectName("");
      setShowAddProject(false);
    }
  };

  const handleAddTag = () => {
    if (newTagName.trim()) {
      onAddTag(newTagName.trim(), newTagColor);
      setNewTagName("");
      setShowAddTag(false);
    }
  };

  const handleUpdateProject = () => {
    if (editingProject && newProjectName.trim()) {
      onEditProject(editingProject.id, newProjectName.trim(), newProjectColor);
      setEditingProject(null);
      setNewProjectName("");
    }
  };

  const toggleTagSelection = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onSelectTags(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onSelectTags([...selectedTagIds, tagId]);
    }
  };

  // Study Groups handlers
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const id = createStudyGroup(newGroupName, undefined, newGroupColor);
    setNewGroupName("");
    setIsCreatingGroup(false);
    setActiveStudyGroup(id);
    setExpandedGroups(new Set([...expandedGroups, id]));
  };

  const handleStartEditGroup = (group: StudyGroup) => {
    setEditingGroupId(group.id);
    setEditGroupName(group.name);
  };

  const handleSaveEditGroup = () => {
    if (editingGroupId && editGroupName.trim()) {
      updateStudyGroup(editingGroupId, { name: editGroupName });
      setEditingGroupId(null);
      setEditGroupName("");
    }
  };

  const toggleGroupExpand = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleAddDocumentToGroup = (groupId: string, docId: string) => {
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
    return libraryDocuments.find((d) => d.id === docId);
  };

  return (
    <div className="w-56 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* All Documents */}
      <div className="p-2">
        <button
          onClick={() => onSelectProject(null)}
          className={`w-full px-3 py-2 rounded-lg text-left text-sm font-medium flex items-center gap-2 transition-colors ${
            selectedProjectId === null
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          All Documents
        </button>
      </div>

      {/* Projects Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <button
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className="w-full px-2 py-1 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
          >
            <span className="flex items-center gap-1">
              {projectsExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              Projects
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddProject(true);
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <Plus className="w-3 h-3" />
            </button>
          </button>

          {projectsExpanded && (
            <div className="mt-1 space-y-1">
              {projects.map((project) => (
                <div key={project.id} className="relative group">
                  <button
                    onClick={() => onSelectProject(project.id)}
                    className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                      selectedProjectId === project.id
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color || "#6b7280" }}
                    />
                    <span className="truncate">{project.name}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuProjectId(
                        menuProjectId === project.id ? null : project.id
                      );
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-opacity"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {menuProjectId === project.id && (
                    <ProjectMenu
                      onEdit={() => {
                        setEditingProject(project);
                        setNewProjectName(project.name);
                        setNewProjectColor(project.color || PROJECT_COLORS[0]);
                        setMenuProjectId(null);
                      }}
                      onDelete={() => {
                        onDeleteProject(project.id);
                        setMenuProjectId(null);
                      }}
                      onClose={() => setMenuProjectId(null)}
                    />
                  )}
                </div>
              ))}

              {showAddProject && (
                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddProject();
                      if (e.key === "Escape") setShowAddProject(false);
                    }}
                  />
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {PROJECT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewProjectColor(color)}
                        className={`w-5 h-5 rounded-full ${
                          newProjectColor === color
                            ? "ring-2 ring-offset-2 ring-blue-500"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleAddProject}
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowAddProject(false)}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setTagsExpanded(!tagsExpanded)}
            className="w-full px-2 py-1 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
          >
            <span className="flex items-center gap-1">
              {tagsExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              Tags
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddTag(true);
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <Plus className="w-3 h-3" />
            </button>
          </button>

          {tagsExpanded && (
            <div className="mt-1 space-y-1">
              {tags.map((tag) => (
                <div key={tag.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => toggleTagSelection(tag.id)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                      selectedTagIds.includes(tag.id)
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    <TagIcon
                      className="w-3 h-3"
                      style={{ color: tag.color || "#6b7280" }}
                    />
                    <span className="truncate">{tag.name}</span>
                  </button>
                  <button
                    onClick={() => onDeleteTag(tag.id)}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {showAddTag && (
                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag name"
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTag();
                      if (e.key === "Escape") setShowAddTag(false);
                    }}
                  />
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {PROJECT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className={`w-5 h-5 rounded-full ${
                          newTagColor === color
                            ? "ring-2 ring-offset-2 ring-blue-500"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleAddTag}
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowAddTag(false)}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Study Groups Section */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setStudyGroupsExpanded(!studyGroupsExpanded)}
            className="w-full px-2 py-1 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
          >
            <span className="flex items-center gap-1">
              {studyGroupsExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              Study Groups
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCreatingGroup(true);
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <FolderPlus className="w-3 h-3" />
            </button>
          </button>

          {studyGroupsExpanded && (
            <div className="mt-1 space-y-0.5">
              {/* Create new group form */}
              {isCreatingGroup && (
                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Group name"
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateGroup();
                      if (e.key === "Escape") setIsCreatingGroup(false);
                    }}
                  />
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {GROUP_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewGroupColor(color)}
                        className={`w-5 h-5 rounded-full ${
                          newGroupColor === color
                            ? "ring-2 ring-offset-2 ring-blue-500"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleCreateGroup}
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setIsCreatingGroup(false)}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Groups list */}
              {studyGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.id);
                const isActive = activeStudyGroupId === group.id;
                const mindMaps = getMindMapsForGroup(group.id);
                const groupDocs = group.documentIds
                  .map((id) => getDocumentById(id))
                  .filter((doc): doc is NonNullable<typeof doc> => doc != null);

                return (
                  <div key={group.id}>
                    {/* Group header */}
                    <div
                      className={`flex items-center px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 group ${
                        isActive ? "bg-purple-100 dark:bg-purple-900/30" : ""
                      }`}
                      onClick={() => {
                        setActiveStudyGroup(group.id);
                        toggleGroupExpand(group.id);
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
                        <FolderOpen className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" style={{ color: group.color }} />
                      ) : (
                        <Folder className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" style={{ color: group.color }} />
                      )}
                      {editingGroupId === group.id ? (
                        <input
                          type="text"
                          value={editGroupName}
                          onChange={(e) => setEditGroupName(e.target.value)}
                          className="flex-1 px-1 text-sm bg-white dark:bg-gray-900 border border-blue-500 rounded focus:outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEditGroup();
                            if (e.key === "Escape") setEditingGroupId(null);
                          }}
                        />
                      ) : (
                        <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                          {group.name}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 mr-1">
                        {group.documentIds.length}
                      </span>
                      {editingGroupId === group.id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEditGroup();
                          }}
                          className="p-0.5 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
                        >
                          <Check className="w-3 h-3 text-green-600" />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditGroup(group);
                            }}
                            className="p-0.5 hover:bg-gray-300 dark:hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100"
                          >
                            <Edit2 className="w-3 h-3 text-gray-500" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Delete this group?")) {
                                deleteStudyGroup(group.id);
                              }
                            }}
                            className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="ml-4 pl-2 border-l border-gray-200 dark:border-gray-700">
                        {/* Documents in group */}
                        {groupDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-750 cursor-pointer rounded group/doc"
                            onClick={() => onOpenDocument?.(doc.file_path)}
                          >
                            <FileText className="w-3 h-3 mr-1.5 text-gray-400 flex-shrink-0" />
                            <span className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                              {doc.title || doc.file_name}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeDocumentFromGroup(group.id, doc.id);
                              }}
                              className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded opacity-0 group-hover/doc:opacity-100"
                            >
                              <X className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                        ))}

                        {/* Mind maps */}
                        {mindMaps.map((mm) => (
                          <div
                            key={mm.id}
                            className="flex items-center px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-750 cursor-pointer rounded"
                            onClick={() => onOpenMindMap?.(mm.id)}
                          >
                            <Network className="w-3 h-3 mr-1.5 text-purple-500 flex-shrink-0" />
                            <span className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                              {mm.name}
                            </span>
                          </div>
                        ))}

                        {/* Actions */}
                        <div className="flex px-1 py-1.5 gap-1">
                          <button
                            onClick={() => setShowDocPicker(group.id)}
                            className="flex items-center px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                          >
                            <Plus className="w-3 h-3 mr-0.5" />
                            Doc
                          </button>
                          <button
                            onClick={() => handleCreateMindMap(group.id)}
                            className="flex items-center px-1.5 py-0.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded"
                          >
                            <Network className="w-3 h-3 mr-0.5" />
                            Map
                          </button>
                        </div>

                        {/* Document picker */}
                        {showDocPicker === group.id && (
                          <div className="px-1 pb-1">
                            <div className="p-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 max-h-32 overflow-y-auto">
                              {libraryDocuments
                                .filter((d) => !group.documentIds.includes(d.id))
                                .map((doc) => (
                                  <div
                                    key={doc.id}
                                    className="flex items-center px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                                    onClick={() => handleAddDocumentToGroup(group.id, doc.id)}
                                  >
                                    <FileText className="w-3 h-3 mr-1.5 text-gray-400" />
                                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                      {doc.title || doc.file_name}
                                    </span>
                                  </div>
                                ))}
                              {libraryDocuments.filter((d) => !group.documentIds.includes(d.id))
                                .length === 0 && (
                                <div className="text-xs text-gray-400 text-center py-1">
                                  No documents
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

              {studyGroups.length === 0 && !isCreatingGroup && (
                <div className="px-2 py-2 text-xs text-gray-400 dark:text-gray-500 text-center">
                  No study groups
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80 shadow-xl">
            <h3 className="font-medium mb-3">Edit Project</h3>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              autoFocus
            />
            <div className="flex gap-1 mt-3 flex-wrap">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewProjectColor(color)}
                  className={`w-6 h-6 rounded-full ${
                    newProjectColor === color
                      ? "ring-2 ring-offset-2 ring-blue-500"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEditingProject(null)}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProject}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectMenu({
  onEdit,
  onDelete,
  onClose,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[120px]">
        <button
          onClick={onEdit}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      </div>
    </>
  );
}
