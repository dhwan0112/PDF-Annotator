import { useState } from "react";
import {
  FileText,
  MoreVertical,
  Trash2,
  FolderInput,
  Tag as TagIcon,
  Clock,
  BookOpen,
} from "lucide-react";
import type { Document, Project, Tag } from "../../stores";

interface DocumentCardProps {
  document: Document;
  projects: Project[];
  tags: Tag[];
  documentTags: string[];
  viewMode: "grid" | "list";
  onOpen: (doc: Document) => void;
  onDelete: (docId: string) => void;
  onSetProject: (docId: string, projectId: string | null) => void;
  onToggleTag: (docId: string, tagId: string, hasTag: boolean) => void;
  onShowBibTeX?: (doc: Document) => void;
}

export function DocumentCard({
  document,
  projects,
  tags,
  documentTags,
  viewMode,
  onOpen,
  onDelete,
  onSetProject,
  onToggleTag,
  onShowBibTeX,
}: DocumentCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);

  const currentProject = projects.find((p) => p.id === document.project_id);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const progress =
    document.page_count && document.page_count > 0
      ? Math.round((document.last_page / document.page_count) * 100)
      : 0;

  if (viewMode === "list") {
    return (
      <div
        className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-colors"
        onClick={() => onOpen(document)}
      >
        <div className="flex-shrink-0 w-10 h-12 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
          <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {document.title || document.file_name}
          </h3>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            {document.author && <span>{document.author}</span>}
            {currentProject && (
              <span
                className="px-2 py-0.5 rounded text-xs"
                style={{
                  backgroundColor: currentProject.color || "#6b7280",
                  color: "white",
                }}
              >
                {currentProject.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          {formatDate(document.last_opened_at)}
        </div>

        {document.page_count && (
          <div className="w-24">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {document.last_page}/{document.page_count} pages
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <DocumentMenu
              onClose={() => setShowMenu(false)}
              onShowProject={() => {
                setShowMenu(false);
                setShowProjectMenu(true);
              }}
              onShowTags={() => {
                setShowMenu(false);
                setShowTagMenu(true);
              }}
              onShowBibTeX={onShowBibTeX ? () => {
                setShowMenu(false);
                onShowBibTeX(document);
              } : undefined}
              onDelete={() => {
                setShowMenu(false);
                onDelete(document.id);
              }}
            />
          )}
          {showProjectMenu && (
            <ProjectMenu
              projects={projects}
              currentProjectId={document.project_id}
              onSelect={(projectId) => {
                onSetProject(document.id, projectId);
                setShowProjectMenu(false);
              }}
              onClose={() => setShowProjectMenu(false)}
            />
          )}
          {showTagMenu && (
            <TagMenu
              tags={tags}
              documentTags={documentTags}
              onToggle={(tagId, hasTag) => {
                onToggleTag(document.id, tagId, hasTag);
              }}
              onClose={() => setShowTagMenu(false)}
            />
          )}
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 overflow-hidden cursor-pointer transition-colors"
      onClick={() => onOpen(document)}
    >
      <div className="aspect-[3/4] bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 flex items-center justify-center relative">
        <FileText className="w-16 h-16 text-red-400 dark:text-red-500" />
        {currentProject && (
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs text-white"
            style={{ backgroundColor: currentProject.color || "#6b7280" }}
          >
            {currentProject.name}
          </div>
        )}
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 rounded shadow"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <DocumentMenu
              onClose={() => setShowMenu(false)}
              onShowProject={() => {
                setShowMenu(false);
                setShowProjectMenu(true);
              }}
              onShowTags={() => {
                setShowMenu(false);
                setShowTagMenu(true);
              }}
              onShowBibTeX={onShowBibTeX ? () => {
                setShowMenu(false);
                onShowBibTeX(document);
              } : undefined}
              onDelete={() => {
                setShowMenu(false);
                onDelete(document.id);
              }}
            />
          )}
          {showProjectMenu && (
            <ProjectMenu
              projects={projects}
              currentProjectId={document.project_id}
              onSelect={(projectId) => {
                onSetProject(document.id, projectId);
                setShowProjectMenu(false);
              }}
              onClose={() => setShowProjectMenu(false)}
            />
          )}
          {showTagMenu && (
            <TagMenu
              tags={tags}
              documentTags={documentTags}
              onToggle={(tagId, hasTag) => {
                onToggleTag(document.id, tagId, hasTag);
              }}
              onClose={() => setShowTagMenu(false)}
            />
          )}
        </div>
      </div>

      <div className="p-3">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
          {document.title || document.file_name}
        </h3>
        {document.author && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
            {document.author}
          </p>
        )}

        {document.page_count && document.page_count > 0 && (
          <div className="mt-2">
            <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {progress}% ({document.last_page}/{document.page_count})
            </p>
          </div>
        )}

        {documentTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {documentTags.slice(0, 3).map((tagId) => {
              const tag = tags.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <span
                  key={tag.id}
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: (tag.color || "#6b7280") + "20",
                    color: tag.color || "#6b7280",
                  }}
                >
                  {tag.name}
                </span>
              );
            })}
            {documentTags.length > 3 && (
              <span className="text-xs text-gray-400">
                +{documentTags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentMenu({
  onClose,
  onShowProject,
  onShowTags,
  onShowBibTeX,
  onDelete,
}: {
  onClose: () => void;
  onShowProject: () => void;
  onShowTags: () => void;
  onShowBibTeX?: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowProject();
          }}
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
        >
          <FolderInput className="w-4 h-4" />
          Move to Project
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowTags();
          }}
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
        >
          <TagIcon className="w-4 h-4" />
          Manage Tags
        </button>
        {onShowBibTeX && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowBibTeX();
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            BibTeX Metadata
          </button>
        )}
        <hr className="my-1 border-gray-200 dark:border-gray-700" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
          Remove from Library
        </button>
      </div>
    </>
  );
}

function ProjectMenu({
  projects,
  currentProjectId,
  onSelect,
  onClose,
}: {
  projects: Project[];
  currentProjectId: string | null;
  onSelect: (projectId: string | null) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px] max-h-64 overflow-y-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(null);
          }}
          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
            currentProjectId === null ? "bg-blue-50 dark:bg-blue-900/20" : ""
          }`}
        >
          No Project
        </button>
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(project.id);
            }}
            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
              currentProjectId === project.id
                ? "bg-blue-50 dark:bg-blue-900/20"
                : ""
            }`}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: project.color || "#6b7280" }}
            />
            {project.name}
          </button>
        ))}
      </div>
    </>
  );
}

function TagMenu({
  tags,
  documentTags,
  onToggle,
  onClose,
}: {
  tags: Tag[];
  documentTags: string[];
  onToggle: (tagId: string, hasTag: boolean) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px] max-h-64 overflow-y-auto">
        {tags.length === 0 ? (
          <div className="px-4 py-2 text-sm text-gray-500">No tags yet</div>
        ) : (
          tags.map((tag) => {
            const hasTag = documentTags.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(tag.id, hasTag);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    hasTag
                      ? "bg-blue-500 border-blue-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {hasTag && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12">
                      <path
                        fill="currentColor"
                        d="M10 3L4.5 8.5 2 6l1-1 1.5 1.5L9 2l1 1z"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className="px-2 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: (tag.color || "#6b7280") + "20",
                    color: tag.color || "#6b7280",
                  }}
                >
                  {tag.name}
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
