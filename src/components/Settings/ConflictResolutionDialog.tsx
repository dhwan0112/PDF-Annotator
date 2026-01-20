import { useState } from "react";
import {
  AlertTriangle,
  Monitor,
  Cloud,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Bookmark,
  Network,
  BookOpen,
  Settings,
  Tag,
} from "lucide-react";
import type { ConflictItem, ConflictResolution, EntityType } from "../../types/sync";

interface ConflictResolutionDialogProps {
  conflicts: ConflictItem[];
  onResolve: (resolvedConflicts: ConflictItem[]) => void;
  onCancel: () => void;
}

const ENTITY_ICONS: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  annotation: FileText,
  bookmark: Bookmark,
  mindmap: Network,
  bibtex: BookOpen,
  study_group: Tag,
  settings: Settings,
};

const ENTITY_LABELS: Record<EntityType, string> = {
  annotation: "Annotations",
  bookmark: "Bookmarks",
  mindmap: "Mind Maps",
  bibtex: "BibTeX Entries",
  study_group: "Study Groups",
  settings: "Settings",
};

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function getDataSummary(data: unknown): string {
  if (!data) return "Empty";

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const keys = Object.keys(obj);

    if (keys.length === 0) return "Empty";

    // For annotations/bookmarks, count items
    if (keys.some((k) => k.includes(".pdf") || k.includes("/"))) {
      const totalItems = keys.reduce((sum, key) => {
        const value = obj[key];
        if (Array.isArray(value)) return sum + value.length;
        if (typeof value === "object" && value) {
          return sum + Object.keys(value).length;
        }
        return sum + 1;
      }, 0);
      return `${keys.length} files, ${totalItems} items`;
    }

    // For other objects, count entries
    return `${keys.length} entries`;
  }

  return String(data).slice(0, 50);
}

function ConflictCard({
  conflict,
  onResolve,
}: {
  conflict: ConflictItem;
  onResolve: (resolution: ConflictResolution) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ENTITY_ICONS[conflict.entityType];

  return (
    <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg overflow-hidden bg-yellow-50 dark:bg-yellow-900/20">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="p-0.5">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>
        <Icon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
        <div className="flex-1">
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {ENTITY_LABELS[conflict.entityType]}
          </span>
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            Conflict detected
          </span>
        </div>
        {conflict.resolution && (
          <span
            className={`px-2 py-0.5 text-xs rounded ${
              conflict.resolution === "local"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                : "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
            }`}
          >
            {conflict.resolution === "local" ? "Keep Local" : "Use Remote"}
          </span>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-yellow-200 dark:border-yellow-800">
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* Local version */}
            <div
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                conflict.resolution === "local"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
              }`}
              onClick={() => onResolve("local")}
            >
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                  Local Version
                </span>
                {conflict.resolution === "local" && (
                  <Check className="w-4 h-4 text-blue-600 ml-auto" />
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Modified: {formatTimestamp(conflict.localVersion.timestamp)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded">
                {getDataSummary(conflict.localData)}
              </div>
            </div>

            {/* Remote version */}
            <div
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                conflict.resolution === "remote"
                  ? "border-green-500 bg-green-50 dark:bg-green-900/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700"
              }`}
              onClick={() => onResolve("remote")}
            >
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                  Remote Version
                </span>
                {conflict.resolution === "remote" && (
                  <Check className="w-4 h-4 text-green-600 ml-auto" />
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Modified: {formatTimestamp(conflict.remoteVersion.timestamp)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded">
                {getDataSummary(conflict.remoteData)}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-3 justify-end">
            <button
              onClick={() => onResolve("local")}
              className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
                conflict.resolution === "local"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <Monitor className="w-3 h-3" />
              Keep Local
            </button>
            <button
              onClick={() => onResolve("remote")}
              className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
                conflict.resolution === "remote"
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <Cloud className="w-3 h-3" />
              Use Remote
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConflictResolutionDialog({
  conflicts,
  onResolve,
  onCancel,
}: ConflictResolutionDialogProps) {
  const [resolvedConflicts, setResolvedConflicts] = useState<ConflictItem[]>(conflicts);

  const handleResolveConflict = (conflictId: string, resolution: ConflictResolution) => {
    setResolvedConflicts((prev) =>
      prev.map((c) => (c.id === conflictId ? { ...c, resolution } : c))
    );
  };

  const allResolved = resolvedConflicts.every((c) => c.resolution);

  const handleApply = () => {
    onResolve(resolvedConflicts);
  };

  const handleKeepAllLocal = () => {
    setResolvedConflicts((prev) => prev.map((c) => ({ ...c, resolution: "local" as const })));
  };

  const handleUseAllRemote = () => {
    setResolvedConflicts((prev) => prev.map((c) => ({ ...c, resolution: "remote" as const })));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Sync Conflicts Detected
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""} need{conflicts.length === 1 ? "s" : ""} resolution
            </p>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">Quick actions:</span>
          <button
            onClick={handleKeepAllLocal}
            className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900"
          >
            Keep All Local
          </button>
          <button
            onClick={handleUseAllRemote}
            className="px-3 py-1 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900"
          >
            Use All Remote
          </button>
        </div>

        {/* Conflicts list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {resolvedConflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              onResolve={(resolution) => handleResolveConflict(conflict.id, resolution)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {resolvedConflicts.filter((c) => c.resolution).length} of {conflicts.length} resolved
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              Cancel Sync
            </button>
            <button
              onClick={handleApply}
              disabled={!allResolved}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply & Continue Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
