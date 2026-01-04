import { useState } from "react";
import { useAnnotationStore } from "../../stores";
import { MessageSquare, X } from "lucide-react";
import type { NoteAnnotation } from "../../types";

interface NoteLayerProps {
  pageNumber: number;
  scale: number;
}

export function NoteLayer({ pageNumber, scale }: NoteLayerProps) {
  const {
    getAnnotationsForPage,
    selectAnnotation,
    selectedAnnotationId,
    updateAnnotation,
    deleteAnnotation,
  } = useAnnotationStore();

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const annotations = getAnnotationsForPage(pageNumber);
  const noteAnnotations = annotations.filter(
    (a): a is NoteAnnotation => a.type === "note"
  );

  const handleNoteClick = (note: NoteAnnotation) => {
    selectAnnotation(note.id);
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleSaveNote = (noteId: string) => {
    updateAnnotation(noteId, { content: editContent });
    setEditingNoteId(null);
  };

  const handleDeleteNote = (noteId: string) => {
    deleteAnnotation(noteId);
    setEditingNoteId(null);
  };

  if (noteAnnotations.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {noteAnnotations.map((note) => {
        const isEditing = editingNoteId === note.id;
        const isSelected = selectedAnnotationId === note.id;

        return (
          <div
            key={note.id}
            className="absolute pointer-events-auto"
            style={{
              left: note.position.x * scale,
              top: note.position.y * scale,
            }}
          >
            {/* Note icon */}
            <button
              onClick={() => handleNoteClick(note)}
              className={`w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110 ${
                isSelected ? "ring-2 ring-blue-500" : ""
              }`}
              style={{ backgroundColor: note.color }}
            >
              <MessageSquare className="w-4 h-4 text-white" />
            </button>

            {/* Note popup */}
            {isEditing && (
              <div
                className="absolute left-8 top-0 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700"
                  style={{ backgroundColor: note.color }}
                >
                  <span className="text-white text-sm font-medium">Note</span>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="text-white hover:bg-white/20 rounded p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-24 p-2 text-sm border border-gray-200 dark:border-gray-600 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Enter note..."
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => setEditingNoteId(null)}
                      className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveNote(note.id)}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
