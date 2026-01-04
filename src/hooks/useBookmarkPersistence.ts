import { useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useBookmarkStore, usePdfStore } from "../stores";
import type { Bookmark } from "../types";

// Serialized bookmark with dates as strings
type SerializedBookmark = Omit<Bookmark, 'createdAt'> & {
  createdAt: string;
};

interface SerializedBookmarks {
  version: number;
  bookmarks: SerializedBookmark[];
}

export function useBookmarkPersistence() {
  const { filePath } = usePdfStore();
  const { bookmarks, setBookmarks, clearBookmarks } = useBookmarkStore();
  const isLoadingRef = useRef(false);
  const lastSavedRef = useRef<string>("");

  // Convert bookmarks to serializable format
  const serializeBookmarks = useCallback((): SerializedBookmarks => {
    return {
      version: 1,
      bookmarks: bookmarks.map((b) => ({
        ...b,
        createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt),
      })),
    };
  }, [bookmarks]);

  // Convert serialized bookmarks back
  const deserializeBookmarks = useCallback(
    (data: SerializedBookmarks): Bookmark[] => {
      return data.bookmarks.map((b) => ({
        ...b,
        createdAt: new Date(b.createdAt),
      }));
    },
    []
  );

  // Save bookmarks
  const saveBookmarks = useCallback(async () => {
    if (!filePath || isLoadingRef.current) return;

    const serialized = serializeBookmarks();
    const json = JSON.stringify(serialized, null, 2);

    // Skip if nothing changed
    if (json === lastSavedRef.current) return;

    try {
      await invoke("save_bookmarks", {
        pdfPath: filePath,
        bookmarksJson: json,
      });
      lastSavedRef.current = json;
      console.log("Bookmarks saved");
    } catch (error) {
      console.error("Failed to save bookmarks:", error);
    }
  }, [filePath, serializeBookmarks]);

  // Load bookmarks
  const loadBookmarks = useCallback(async () => {
    if (!filePath) return;

    isLoadingRef.current = true;
    try {
      const json = await invoke<string | null>("load_bookmarks", {
        pdfPath: filePath,
      });

      if (json) {
        const data: SerializedBookmarks = JSON.parse(json);
        const loadedBookmarks = deserializeBookmarks(data);
        setBookmarks(loadedBookmarks);
        lastSavedRef.current = json;
        console.log("Bookmarks loaded");
      } else {
        clearBookmarks();
        lastSavedRef.current = "";
      }
    } catch (error) {
      console.error("Failed to load bookmarks:", error);
      clearBookmarks();
    } finally {
      isLoadingRef.current = false;
    }
  }, [filePath, deserializeBookmarks, setBookmarks, clearBookmarks]);

  // Load bookmarks when file changes
  useEffect(() => {
    if (filePath) {
      loadBookmarks();
    }
  }, [filePath, loadBookmarks]);

  // Auto-save with debounce
  useEffect(() => {
    if (!filePath || isLoadingRef.current) return;

    const timeoutId = setTimeout(() => {
      saveBookmarks();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [filePath, bookmarks, saveBookmarks]);

  return {
    saveBookmarks,
    loadBookmarks,
  };
}
