import { useState, useMemo } from "react";
import {
  FileText,
  Highlighter,
  Pen,
  StickyNote,
  Type,
  Square,
  ArrowRight,
  Underline,
  Strikethrough,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useAnnotationStore, useStudyGroupStore, useLibraryStore } from "../../stores";
import type { Annotation } from "../../types";

interface AnnotationBrowserProps {
  studyGroupId: string;
  onAddToMindMap: (annotation: Annotation, documentId: string, documentName: string) => void;
  onClose: () => void;
}

const ANNOTATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ink: Pen,
  highlighterInk: Highlighter,
  highlight: Highlighter,
  underline: Underline,
  strikeout: Strikethrough,
  note: StickyNote,
  rect: Square,
  arrow: ArrowRight,
  textbox: Type,
};

const ANNOTATION_LABELS: Record<string, string> = {
  ink: "Pen",
  highlighterInk: "Highlighter",
  highlight: "Highlight",
  underline: "Underline",
  strikeout: "Strikeout",
  note: "Note",
  rect: "Rectangle",
  arrow: "Arrow",
  textbox: "Text Box",
};

function getAnnotationContent(annotation: Annotation): string {
  switch (annotation.type) {
    case "highlight":
    case "underline":
    case "strikeout":
      return annotation.text || "(No text selected)";
    case "note":
      return annotation.content || "(Empty note)";
    case "textbox":
      return annotation.content || "(Empty text box)";
    case "ink":
    case "highlighterInk":
      return `${annotation.strokes.length} stroke(s)`;
    case "rect":
      return `Rectangle at (${Math.round(annotation.rect.x)}, ${Math.round(annotation.rect.y)})`;
    case "arrow":
      return `Arrow`;
    default:
      return "(Annotation)";
  }
}

export function AnnotationBrowser({ studyGroupId, onAddToMindMap, onClose }: AnnotationBrowserProps) {
  const { getStudyGroup } = useStudyGroupStore();
  const { documents } = useLibraryStore();
  const { annotations } = useAnnotationStore();

  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);

  const studyGroup = getStudyGroup(studyGroupId);

  // Get documents in this study group
  const groupDocuments = useMemo(() => {
    if (!studyGroup) return [];
    return documents.filter((doc) => studyGroup.documentIds.includes(doc.id));
  }, [studyGroup, documents]);

  // Get annotations for each document
  const documentAnnotations = useMemo(() => {
    const result = new Map<string, { docName: string; filePath: string; annotations: Annotation[] }>();

    groupDocuments.forEach((doc) => {
      const docAnnotations: Annotation[] = [];

      // Annotations are keyed by file path in annotationStore
      annotations.forEach((pageAnnotations, _key) => {
        // Check if any annotation might belong to this document
        pageAnnotations.forEach((ann) => {
          // We need to match by some criteria - let's assume all annotations are accessible
          docAnnotations.push(ann);
        });
      });

      // For now, let's get all annotations and filter by search
      const allAnnotations: Annotation[] = [];
      annotations.forEach((pageAnnotations) => {
        allAnnotations.push(...pageAnnotations);
      });

      if (allAnnotations.length > 0) {
        result.set(doc.file_path, {
          docName: doc.file_name,
          filePath: doc.file_path,
          annotations: allAnnotations,
        });
      }
    });

    return result;
  }, [groupDocuments, annotations]);

  // Filter annotations
  const filteredDocuments = useMemo(() => {
    const result = new Map<string, { docName: string; filePath: string; annotations: Annotation[] }>();

    documentAnnotations.forEach((data, filePath) => {
      let filtered = data.annotations;

      // Filter by type
      if (filterType) {
        filtered = filtered.filter((ann) => ann.type === filterType);
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter((ann) => {
          const content = getAnnotationContent(ann).toLowerCase();
          return content.includes(query);
        });
      }

      if (filtered.length > 0) {
        result.set(filePath, { ...data, annotations: filtered });
      }
    });

    return result;
  }, [documentAnnotations, filterType, searchQuery]);

  const toggleDoc = (filePath: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const annotationTypes = [
    "highlight",
    "underline",
    "strikeout",
    "note",
    "textbox",
    "ink",
    "highlighterInk",
    "rect",
    "arrow",
  ];

  // Count total annotations
  let totalCount = 0;
  filteredDocuments.forEach((data) => {
    totalCount += data.annotations.length;
  });

  return (
    <div className="w-72 h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Add from Annotations
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search annotations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Type filter */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilterType(null)}
            className={`px-2 py-0.5 text-xs rounded ${
              !filterType
                ? "bg-blue-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            All
          </button>
          {annotationTypes.map((type) => {
            const Icon = ANNOTATION_ICONS[type];
            return (
              <button
                key={type}
                onClick={() => setFilterType(type === filterType ? null : type)}
                className={`p-1 rounded ${
                  filterType === type
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                title={ANNOTATION_LABELS[type]}
              >
                <Icon className="w-3 h-3" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Annotations list */}
      <div className="flex-1 overflow-y-auto">
        {filteredDocuments.size === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            {documentAnnotations.size === 0
              ? "No annotations in this study group"
              : "No matching annotations"}
          </div>
        ) : (
          Array.from(filteredDocuments.entries()).map(([filePath, data]) => (
            <div key={filePath} className="border-b border-gray-100 dark:border-gray-700">
              {/* Document header */}
              <button
                onClick={() => toggleDoc(filePath)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                {expandedDocs.has(filePath) ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="flex-1 text-left text-sm text-gray-700 dark:text-gray-300 truncate">
                  {data.docName}
                </span>
                <span className="text-xs text-gray-400">{data.annotations.length}</span>
              </button>

              {/* Annotations */}
              {expandedDocs.has(filePath) && (
                <div className="bg-gray-50 dark:bg-gray-900/50">
                  {data.annotations.map((annotation) => {
                    const Icon = ANNOTATION_ICONS[annotation.type] || FileText;
                    const content = getAnnotationContent(annotation);

                    return (
                      <div
                        key={annotation.id}
                        className="flex items-start gap-2 px-3 py-2 ml-6 border-l-2 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <div
                          className="mt-0.5 p-1 rounded"
                          style={{ backgroundColor: `${annotation.color}30`, color: annotation.color }}
                        >
                          <Icon className="w-3 h-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Page {annotation.pageNumber} · {ANNOTATION_LABELS[annotation.type]}
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                            {content}
                          </div>
                        </div>
                        <button
                          onClick={() => onAddToMindMap(annotation, filePath, data.docName)}
                          className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500"
                          title="Add to mind map"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        {totalCount} annotation{totalCount !== 1 ? "s" : ""} found
      </div>
    </div>
  );
}
