import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

export interface ShortcutConfig {
  id: string;
  label: string;
  category: string;
  binding: KeyBinding;
}

// Default keyboard shortcuts
const DEFAULT_SHORTCUTS: Record<string, ShortcutConfig> = {
  // Tools
  "tool.select": { id: "tool.select", label: "Select Tool", category: "Tools", binding: { key: "v" } },
  "tool.pen": { id: "tool.pen", label: "Pen Tool", category: "Tools", binding: { key: "p" } },
  "tool.highlighter": { id: "tool.highlighter", label: "Highlighter", category: "Tools", binding: { key: "h" } },
  "tool.eraser": { id: "tool.eraser", label: "Eraser", category: "Tools", binding: { key: "e" } },
  "tool.note": { id: "tool.note", label: "Sticky Note", category: "Tools", binding: { key: "n" } },
  "tool.underline": { id: "tool.underline", label: "Underline", category: "Tools", binding: { key: "u" } },
  "tool.strikeout": { id: "tool.strikeout", label: "Strikeout", category: "Tools", binding: { key: "s" } },
  "tool.rect": { id: "tool.rect", label: "Rectangle", category: "Tools", binding: { key: "r" } },
  "tool.arrow": { id: "tool.arrow", label: "Arrow", category: "Tools", binding: { key: "a" } },

  // Edit
  "edit.undo": { id: "edit.undo", label: "Undo", category: "Edit", binding: { key: "z", ctrl: true } },
  "edit.redo": { id: "edit.redo", label: "Redo", category: "Edit", binding: { key: "y", ctrl: true } },
  "edit.redoAlt": { id: "edit.redoAlt", label: "Redo (Alt)", category: "Edit", binding: { key: "z", ctrl: true, shift: true } },

  // View
  "view.zoomIn": { id: "view.zoomIn", label: "Zoom In", category: "View", binding: { key: "=", ctrl: true } },
  "view.zoomOut": { id: "view.zoomOut", label: "Zoom Out", category: "View", binding: { key: "-", ctrl: true } },

  // Navigation
  "nav.nextPage": { id: "nav.nextPage", label: "Next Page", category: "Navigation", binding: { key: "PageDown" } },
  "nav.prevPage": { id: "nav.prevPage", label: "Previous Page", category: "Navigation", binding: { key: "PageUp" } },
  "nav.firstPage": { id: "nav.firstPage", label: "First Page", category: "Navigation", binding: { key: "Home" } },
  "nav.lastPage": { id: "nav.lastPage", label: "Last Page", category: "Navigation", binding: { key: "End" } },

  // File
  "file.open": { id: "file.open", label: "Open File", category: "File", binding: { key: "o", ctrl: true } },
  "file.backToLibrary": { id: "file.backToLibrary", label: "Back to Library", category: "File", binding: { key: "Escape" } },

  // Features
  "feature.toggleMargin": { id: "feature.toggleMargin", label: "Toggle Margin Drawing", category: "Features", binding: { key: "m", ctrl: true } },
  "feature.toggleMindMap": { id: "feature.toggleMindMap", label: "Toggle Mind Map Panel", category: "Features", binding: { key: "m", ctrl: true, shift: true } },
};

interface SettingsState {
  // Keyboard shortcuts
  shortcuts: Record<string, ShortcutConfig>;

  // Feature settings
  marginDrawingEnabled: boolean;

  // Actions
  getShortcut: (id: string) => ShortcutConfig | undefined;
  setShortcut: (id: string, binding: KeyBinding) => void;
  resetShortcut: (id: string) => void;
  resetAllShortcuts: () => void;
  matchesShortcut: (id: string, event: KeyboardEvent) => boolean;
  findShortcutByEvent: (event: KeyboardEvent) => string | null;
  getShortcutsByCategory: () => Record<string, ShortcutConfig[]>;
  formatShortcut: (binding: KeyBinding) => string;
  toggleMarginDrawing: () => void;
  setMarginDrawing: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      shortcuts: { ...DEFAULT_SHORTCUTS },
      marginDrawingEnabled: false,

      toggleMarginDrawing: () => {
        set((state) => ({ marginDrawingEnabled: !state.marginDrawingEnabled }));
      },

      setMarginDrawing: (enabled) => {
        set({ marginDrawingEnabled: enabled });
      },

      getShortcut: (id) => {
        return get().shortcuts[id];
      },

      setShortcut: (id, binding) => {
        const { shortcuts } = get();
        const existing = shortcuts[id];
        if (existing) {
          set({
            shortcuts: {
              ...shortcuts,
              [id]: { ...existing, binding },
            },
          });
        }
      },

      resetShortcut: (id) => {
        const { shortcuts } = get();
        const defaultShortcut = DEFAULT_SHORTCUTS[id];
        if (defaultShortcut) {
          set({
            shortcuts: {
              ...shortcuts,
              [id]: { ...defaultShortcut },
            },
          });
        }
      },

      resetAllShortcuts: () => {
        set({ shortcuts: { ...DEFAULT_SHORTCUTS } });
      },

      matchesShortcut: (id, event) => {
        const shortcut = get().shortcuts[id];
        if (!shortcut) return false;

        const { binding } = shortcut;
        const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase() ||
                        event.code.toLowerCase() === binding.key.toLowerCase();
        const ctrlMatch = !!binding.ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatch = !!binding.shift === event.shiftKey;
        const altMatch = !!binding.alt === event.altKey;

        return keyMatch && ctrlMatch && shiftMatch && altMatch;
      },

      findShortcutByEvent: (event) => {
        const { shortcuts, matchesShortcut } = get();
        for (const id of Object.keys(shortcuts)) {
          if (matchesShortcut(id, event)) {
            return id;
          }
        }
        return null;
      },

      getShortcutsByCategory: () => {
        const { shortcuts } = get();
        const byCategory: Record<string, ShortcutConfig[]> = {};

        Object.values(shortcuts).forEach((shortcut) => {
          if (!byCategory[shortcut.category]) {
            byCategory[shortcut.category] = [];
          }
          byCategory[shortcut.category].push(shortcut);
        });

        return byCategory;
      },

      formatShortcut: (binding) => {
        const parts: string[] = [];
        if (binding.ctrl) parts.push("Ctrl");
        if (binding.shift) parts.push("Shift");
        if (binding.alt) parts.push("Alt");
        if (binding.meta) parts.push("Cmd");

        // Format the key nicely
        let key = binding.key;
        if (key === " ") key = "Space";
        else if (key.length === 1) key = key.toUpperCase();

        parts.push(key);
        return parts.join("+");
      },
    }),
    {
      name: "pdf-annotator-settings",
    }
  )
);
