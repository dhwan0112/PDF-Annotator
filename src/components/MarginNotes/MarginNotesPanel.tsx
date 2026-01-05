import { useState, useCallback } from "react";
import { useStudyGroupStore, useLibraryStore } from "../../stores";
import type { MarginNote } from "../../types";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Link,
  Edit2,
  Save,
  X,
} from "lucide-react";

interface MarginNotesPanelProps {
  documentId: string;
  pageNumber: number;
  onLinkAnnotation?: (noteId: string) => void;
}

const NOTE_COLORS = [
  "#fef3c7", "#fce7f3", "#dbeafe", "#d1fae5", "#e9d5ff",
  "#fed7aa", "#cffafe", "#fecaca",
];

export function MarginNotesPanel({
  documentId,
  pageNumber,
  onLinkAnnotation,
}: MarginNotesPanelProps) {
  const {
    getMarginNotesForPage,
    addMarginNote,
    updateMarginNote,
    deleteMarginNote,
  } = useStudyGroupStore();
  const { documents } = useLibraryStore();

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0]);

  // Get document from library to get its ID
  const document = documents.find((d) => d.file_path === documentId || d.id === documentId);
  const effectiveDocId = document?.id || documentId;

  const notes = getMarginNotesForPage(effectiveDocId, pageNumber);

  const handleCreateNote = useCallback(() => {
    if (!newNoteContent.trim()) return;

    addMarginNote({
      documentId: effectiveDocId,
      pageNumber,
      yPosition: 0.5, // Default to middle of page
      content: newNoteContent,
      color: selectedColor,
      collapsed: false,
    });

    setNewNoteContent("");
    setIsCreating(false);
  }, [addMarginNote, effectiveDocId, pageNumber, newNoteContent, selectedColor]);

  const handleStartEdit = (note: MarginNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = () => {
    if (editingNoteId) {
      updateMarginNote(editingNoteId, { content: editContent });
      setEditingNoteId(null);
      setEditContent("");
    }
  };

  const handleToggleCollapse = (noteId: string, collapsed: boolean) => {
    updateMarginNote(noteId, { collapsed: !collapsed });
  };

  return (
    <div className="w-72 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Margin Notes
        </h3>
        <button
          onClick={() => setIsCreating(true)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title="Add note"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Create new note form */}
        {isCreating && (
          <div className="p-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800">
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Write your note..."
              className="w-full h-20 p-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            {/* Color picker */}
            <div className="flex items-center gap-1 mt-2">
              {NOTE_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-5 h-5 rounded-full border-2 ${
                    selectedColor === color
                      ? "border-blue-500 ring-1 ring-blue-300"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            {/* Actions */}
            <div className="flex justify-end gap-1 mt-2">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewNoteContent("");
                }}
                className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNote}
                disabled={!newNoteContent.trim()}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Add Note
              </button>
            </div>
          </div>
        )}

        {/* Existing notes */}
        {notes.map((note) => (
          <div
            key={note.id}
            className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            style={{ backgroundColor: note.color }}
          >
            {/* Note header */}
            <div className="flex items-center px-2 py-1 bg-black/5 dark:bg-black/20">
              <button
                onClick={() => handleToggleCollapse(note.id, note.collapsed)}
                className="p-0.5 hover:bg-black/10 rounded"
              >
                {note.collapsed ? (
                  <ChevronRight className="w-3 h-3 text-gray-600" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-gray-600" />
                )}
              </button>
              <span className="flex-1 text-xs text-gray-600 ml-1 truncate">
                Page {note.pageNumber}
              </span>
              <div className="flex items-center gap-0.5">
                {onLinkAnnotation && (
                  <button
                    onClick={() => onLinkAnnotation(note.id)}
                    className="p-0.5 hover:bg-black/10 rounded text-gray-600"
                    title="Link to annotation"
                  >
                    <Link className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => handleStartEdit(note)}
                  className="p-0.5 hover:bg-black/10 rounded text-gray-600"
                  title="Edit"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteMarginNote(note.id)}
                  className="p-0.5 hover:bg-black/10 rounded text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Note content */}
            {!note.collapsed && (
              <div className="p-2">
                {editingNoteId === note.id ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-20 p-2 text-sm border border-gray-300 rounded bg-white/80 text-gray-900 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1 mt-1">
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="p-1 hover:bg-black/10 rounded"
                      >
                        <X className="w-3 h-3 text-gray-600" />
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="p-1 hover:bg-black/10 rounded"
                      >
                        <Save className="w-3 h-3 text-blue-600" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {note.content}
                  </p>
                )}
                {note.linkedAnnotationId && (
                  <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                    <Link className="w-3 h-3" />
                    Linked to annotation
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {notes.length === 0 && !isCreating && (
          <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
            No notes on this page.
            <br />
            Click + to add a note.
          </div>
        )}
      </div>
    </div>
  );
}
