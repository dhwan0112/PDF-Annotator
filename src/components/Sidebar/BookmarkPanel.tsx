import { useState, useRef, useEffect } from "react";
import { useBookmarkStore, usePdfStore } from "../../stores";
import { Bookmark, Plus, Trash2, Edit2, GripVertical, Search, X } from "lucide-react";
import type { Bookmark as BookmarkType } from "../../types";

const BOOKMARK_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export function BookmarkPanel() {
  const { currentPage, goToPage } = usePdfStore();
  const {
    addBookmark,
    updateBookmark,
    deleteBookmark,
    reorderBookmarks,
    searchQuery,
    setSearchQuery,
    getFilteredBookmarks,
  } = useBookmarkStore();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newColor, setNewColor] = useState(BOOKMARK_COLORS[4]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const globalDragHandlerRef = useRef<((e: DragEvent) => void) | null>(null);

  const filteredBookmarks = getFilteredBookmarks();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove("bookmark-dragging");
      if (globalDragHandlerRef.current) {
        document.removeEventListener("dragover", globalDragHandlerRef.current);
        document.removeEventListener("dragenter", globalDragHandlerRef.current);
        globalDragHandlerRef.current = null;
      }
    };
  }, []);

  const handleAddBookmark = () => {
    if (!newTitle.trim()) return;

    const bookmark: BookmarkType = {
      id: crypto.randomUUID(),
      pageNumber: currentPage,
      title: newTitle.trim(),
      note: newNote.trim() || undefined,
      color: newColor,
      createdAt: new Date(),
    };

    addBookmark(bookmark);
    setNewTitle("");
    setNewNote("");
    setIsAdding(false);
  };

  const handleUpdateBookmark = (id: string) => {
    if (!newTitle.trim()) return;

    updateBookmark(id, {
      title: newTitle.trim(),
      note: newNote.trim() || undefined,
      color: newColor,
    });

    setEditingId(null);
    setNewTitle("");
    setNewNote("");
  };

  const startEditing = (bookmark: BookmarkType) => {
    setEditingId(bookmark.id);
    setNewTitle(bookmark.title);
    setNewNote(bookmark.note || "");
    setNewColor(bookmark.color || BOOKMARK_COLORS[4]);
    setIsAdding(false);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";

    // Add global handler immediately to prevent forbidden cursor
    document.body.classList.add("bookmark-dragging");
    const globalHandler = (ev: DragEvent) => {
      ev.preventDefault();
      if (ev.dataTransfer) {
        ev.dataTransfer.dropEffect = "move";
      }
    };
    globalDragHandlerRef.current = globalHandler;
    document.addEventListener("dragover", globalHandler);
    document.addEventListener("dragenter", globalHandler);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (draggedIndex === null || draggedIndex === index) return;

    reorderBookmarks(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    document.body.classList.remove("bookmark-dragging");
    if (globalDragHandlerRef.current) {
      document.removeEventListener("dragover", globalDragHandlerRef.current);
      document.removeEventListener("dragenter", globalDragHandlerRef.current);
      globalDragHandlerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search bookmarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded border-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Add bookmark button */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setNewTitle("");
            setNewNote("");
            setNewColor(BOOKMARK_COLORS[4]);
          }}
          className="flex items-center gap-2 w-full p-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add bookmark for page {currentPage}</span>
        </button>
      </div>

      {/* Add/Edit form */}
      {(isAdding || editingId) && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <input
            type="text"
            placeholder="Bookmark title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full p-2 text-sm bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            autoFocus
          />
          <textarea
            placeholder="Note (optional)"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="w-full p-2 text-sm bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 h-16 resize-none"
          />
          <div className="flex gap-1 mb-2">
            {BOOKMARK_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={`w-6 h-6 rounded-full transition-transform ${
                  newColor === color ? "ring-2 ring-offset-2 ring-blue-500 scale-110" : ""
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setIsAdding(false);
                setEditingId(null);
              }}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                editingId ? handleUpdateBookmark(editingId) : handleAddBookmark()
              }
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={!newTitle.trim()}
            >
              {editingId ? "Update" : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* Bookmark list */}
      <div className="flex-1 overflow-y-auto">
        {filteredBookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm p-4">
            <Bookmark className="w-8 h-8 mb-2" />
            <p>No bookmarks yet</p>
            <p className="text-xs mt-1">Click "Add bookmark" to create one</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredBookmarks.map((bookmark, index) => (
              <li
                key={bookmark.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`group flex items-start gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                  draggedIndex === index ? "opacity-50" : ""
                }`}
                onClick={() => goToPage(bookmark.pageNumber)}
              >
                <div className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                </div>
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: bookmark.color || BOOKMARK_COLORS[4] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium truncate">{bookmark.title}</h4>
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                      p.{bookmark.pageNumber}
                    </span>
                  </div>
                  {bookmark.note && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {bookmark.note}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(bookmark);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-500 rounded"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBookmark(bookmark.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
