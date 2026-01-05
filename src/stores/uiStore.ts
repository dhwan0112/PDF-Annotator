import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "../types";

export type AppView = "library" | "viewer";

interface UiState {
  // View
  currentView: AppView;

  // Theme
  theme: Theme;

  // Sidebar
  sidebarVisible: boolean;
  sidebarWidth: number;
  activePanel: "thumbnails" | "bookmarks" | "annotations" | "outline";

  // Toolbar
  toolbarPosition: "top" | "left";

  // Actions
  setCurrentView: (view: AppView) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSidebarVisible: (visible: boolean) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setActivePanel: (
    panel: "thumbnails" | "bookmarks" | "annotations" | "outline"
  ) => void;
  setToolbarPosition: (position: "top" | "left") => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentView: "library",
      theme: "system",
      sidebarVisible: true,
      sidebarWidth: 280,
      activePanel: "thumbnails",
      toolbarPosition: "top",

      // Actions
      setCurrentView: (view) => set({ currentView: view }),

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      toggleTheme: () => {
        const { theme } = get();
        const nextTheme: Theme =
          theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
        set({ theme: nextTheme });
        applyTheme(nextTheme);
      },

      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),

      toggleSidebar: () => {
        const { sidebarVisible } = get();
        set({ sidebarVisible: !sidebarVisible });
      },

      setSidebarWidth: (width) => {
        const clampedWidth = Math.max(200, Math.min(500, width));
        set({ sidebarWidth: clampedWidth });
      },

      setActivePanel: (panel) => set({ activePanel: panel }),

      setToolbarPosition: (position) => set({ toolbarPosition: position }),
    }),
    {
      name: "pdf-annotator-ui",
    }
  )
);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// Initialize theme on load
if (typeof window !== "undefined") {
  const stored = localStorage.getItem("pdf-annotator-ui");
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      applyTheme(state.theme);
    } catch {
      applyTheme("system");
    }
  }
}
