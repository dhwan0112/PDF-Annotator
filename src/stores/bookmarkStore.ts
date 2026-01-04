import { create } from "zustand";
import type { Bookmark } from "../types";

interface BookmarkState {
  bookmarks: Bookmark[];
  searchQuery: string;

  // Actions
  addBookmark: (bookmark: Bookmark) => void;
  updateBookmark: (id: string, updates: Partial<Bookmark>) => void;
  deleteBookmark: (id: string) => void;
  reorderBookmarks: (fromIndex: number, toIndex: number) => void;
  setSearchQuery: (query: string) => void;
  getFilteredBookmarks: () => Bookmark[];
  setBookmarks: (bookmarks: Bookmark[]) => void;
  clearBookmarks: () => void;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  searchQuery: "",

  addBookmark: (bookmark) => {
    set((state) => ({
      bookmarks: [...state.bookmarks, bookmark],
    }));
  },

  updateBookmark: (id, updates) => {
    set((state) => ({
      bookmarks: state.bookmarks.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    }));
  },

  deleteBookmark: (id) => {
    set((state) => ({
      bookmarks: state.bookmarks.filter((b) => b.id !== id),
    }));
  },

  reorderBookmarks: (fromIndex, toIndex) => {
    set((state) => {
      const newBookmarks = [...state.bookmarks];
      const [removed] = newBookmarks.splice(fromIndex, 1);
      newBookmarks.splice(toIndex, 0, removed);
      return { bookmarks: newBookmarks };
    });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  getFilteredBookmarks: () => {
    const { bookmarks, searchQuery } = get();
    if (!searchQuery.trim()) return bookmarks;

    const query = searchQuery.toLowerCase();
    return bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(query) ||
        b.note?.toLowerCase().includes(query)
    );
  },

  setBookmarks: (bookmarks) => {
    set({ bookmarks });
  },

  clearBookmarks: () => {
    set({ bookmarks: [], searchQuery: "" });
  },
}));
