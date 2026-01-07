import { useEffect, useMemo } from "react";
import {
  Search,
  Grid,
  List,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useLibraryStore } from "../../stores";
import { DocumentCard } from "./DocumentCard";
import { ProjectSidebar } from "./ProjectSidebar";

interface LibraryProps {
  onOpenDocument: (filePath: string) => void;
  onOpenMindMap?: (mindMapId: string) => void;
}

export function Library({ onOpenDocument, onOpenMindMap }: LibraryProps) {
  const {
    documents,
    projects,
    tags,
    documentTags,
    isInitialized,
    isLoading,
    error,
    selectedProjectId,
    selectedTagIds,
    searchQuery,
    viewMode,
    initLibrary,
    loadDocuments,
    loadDocumentsByProject,
    deleteDocument,
    setDocumentProject,
    searchDocuments,
    addProject,
    updateProject,
    deleteProject,
    addTag,
    deleteTag,
    addDocumentTag,
    removeDocumentTag,
    loadDocumentTags,
    setSelectedProject,
    setSelectedTags,
    setSearchQuery,
    setViewMode,
  } = useLibraryStore();

  // Initialize library on mount
  useEffect(() => {
    initLibrary();
  }, [initLibrary]);

  // Load documents when project changes
  useEffect(() => {
    if (!isInitialized) return;

    if (selectedProjectId) {
      loadDocumentsByProject(selectedProjectId);
    } else {
      loadDocuments();
    }
  }, [isInitialized, selectedProjectId, loadDocuments, loadDocumentsByProject]);

  // Load document tags
  useEffect(() => {
    if (!isInitialized) return;
    documents.forEach((doc) => {
      if (!documentTags.has(doc.id)) {
        loadDocumentTags(doc.id);
      }
    });
  }, [isInitialized, documents, documentTags, loadDocumentTags]);

  // Filter documents by search and tags
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.file_name.toLowerCase().includes(query) ||
          doc.title?.toLowerCase().includes(query) ||
          doc.author?.toLowerCase().includes(query)
      );
    }

    // Filter by selected tags
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((doc) => {
        const docTags = documentTags.get(doc.id) || [];
        return selectedTagIds.every((tagId) => docTags.includes(tagId));
      });
    }

    return filtered;
  }, [documents, searchQuery, selectedTagIds, documentTags]);

  // Sort documents by last opened
  const sortedDocuments = useMemo(() => {
    return [...filteredDocuments].sort((a, b) => {
      const dateA = a.last_opened_at ? new Date(a.last_opened_at).getTime() : 0;
      const dateB = b.last_opened_at ? new Date(b.last_opened_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [filteredDocuments]);

  const handleOpenDocument = (doc: typeof documents[0]) => {
    onOpenDocument(doc.file_path);
  };

  const handleToggleTag = async (
    docId: string,
    tagId: string,
    hasTag: boolean
  ) => {
    if (hasTag) {
      await removeDocumentTag(docId, tagId);
    } else {
      await addDocumentTag(docId, tagId);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim()) {
      searchDocuments(query);
    } else {
      loadDocuments();
    }
  };

  const handleRefresh = () => {
    if (selectedProjectId) {
      loadDocumentsByProject(selectedProjectId);
    } else {
      loadDocuments();
    }
  };

  if (!isInitialized && isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">Loading library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <ProjectSidebar
        projects={projects}
        tags={tags}
        selectedProjectId={selectedProjectId}
        selectedTagIds={selectedTagIds}
        onSelectProject={setSelectedProject}
        onSelectTags={setSelectedTags}
        onAddProject={addProject}
        onEditProject={updateProject}
        onDeleteProject={deleteProject}
        onAddTag={addTag}
        onDeleteTag={deleteTag}
        onOpenDocument={onOpenDocument}
        onOpenMindMap={onOpenMindMap}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search documents..."
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-gray-600 shadow"
                    : "hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded ${
                  viewMode === "list"
                    ? "bg-white dark:bg-gray-600 shadow"
                    : "hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {/* Selected Tags */}
          {selectedTagIds.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-gray-500">Filtering by:</span>
              {selectedTagIds.map((tagId) => {
                const tag = tags.find((t) => t.id === tagId);
                if (!tag) return null;
                return (
                  <button
                    key={tag.id}
                    onClick={() =>
                      setSelectedTags(selectedTagIds.filter((id) => id !== tagId))
                    }
                    className="px-2 py-1 rounded-full text-xs flex items-center gap-1 hover:opacity-80"
                    style={{
                      backgroundColor: (tag.color || "#6b7280") + "20",
                      color: tag.color || "#6b7280",
                    }}
                  >
                    {tag.name}
                    <span className="ml-1">&times;</span>
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedTags([])}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Document Grid/List */}
        <div className="flex-1 overflow-y-auto p-4">
          {sortedDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <FileText className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No documents</p>
              <p className="text-sm mt-1">
                {searchQuery
                  ? "No documents match your search"
                  : "Open a PDF to add it to your library"}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {sortedDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  projects={projects}
                  tags={tags}
                  documentTags={documentTags.get(doc.id) || []}
                  viewMode={viewMode}
                  onOpen={handleOpenDocument}
                  onDelete={deleteDocument}
                  onSetProject={setDocumentProject}
                  onToggleTag={handleToggleTag}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  projects={projects}
                  tags={tags}
                  documentTags={documentTags.get(doc.id) || []}
                  viewMode={viewMode}
                  onOpen={handleOpenDocument}
                  onDelete={deleteDocument}
                  onSetProject={setDocumentProject}
                  onToggleTag={handleToggleTag}
                />
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          {sortedDocuments.length} document{sortedDocuments.length !== 1 && "s"}
          {selectedProjectId && (
            <span>
              {" "}
              in{" "}
              {projects.find((p) => p.id === selectedProjectId)?.name ||
                "project"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
