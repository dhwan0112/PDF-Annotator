import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PdfMetadata, ViewMode } from "../types";

export interface TabState {
  id: string;
  filePath: string;
  metadata: PdfMetadata | null;
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  rotation: number;
  viewMode: ViewMode;
  scrollPosition: number;
}

interface TabStoreState {
  tabs: TabState[];
  activeTabId: string | null;

  // Actions
  openTab: (filePath: string, metadata: PdfMetadata | null) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<TabState>) => void;
  getActiveTab: () => TabState | null;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
}

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useTabStore = create<TabStoreState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      openTab: (filePath, metadata) => {
        const { tabs } = get();

        // Check if file is already open
        const existingTab = tabs.find((t) => t.filePath === filePath);
        if (existingTab) {
          set({ activeTabId: existingTab.id });
          return existingTab.id;
        }

        // Create new tab
        const newTab: TabState = {
          id: generateTabId(),
          filePath,
          metadata,
          currentPage: 1,
          totalPages: 0,
          zoomLevel: 1.0,
          rotation: 0,
          viewMode: "continuous",
          scrollPosition: 0,
        };

        set({
          tabs: [...tabs, newTab],
          activeTabId: newTab.id,
        });

        return newTab.id;
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get();
        const tabIndex = tabs.findIndex((t) => t.id === tabId);
        if (tabIndex === -1) return;

        const newTabs = tabs.filter((t) => t.id !== tabId);

        // If closing active tab, switch to adjacent tab
        let newActiveTabId = activeTabId;
        if (activeTabId === tabId) {
          if (newTabs.length === 0) {
            newActiveTabId = null;
          } else if (tabIndex >= newTabs.length) {
            newActiveTabId = newTabs[newTabs.length - 1].id;
          } else {
            newActiveTabId = newTabs[tabIndex].id;
          }
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveTabId,
        });
      },

      setActiveTab: (tabId) => {
        const { tabs } = get();
        if (tabs.some((t) => t.id === tabId)) {
          set({ activeTabId: tabId });
        }
      },

      updateTab: (tabId, updates) => {
        const { tabs } = get();
        set({
          tabs: tabs.map((t) =>
            t.id === tabId ? { ...t, ...updates } : t
          ),
        });
      },

      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find((t) => t.id === activeTabId) || null;
      },

      closeAllTabs: () => {
        set({ tabs: [], activeTabId: null });
      },

      closeOtherTabs: (tabId) => {
        const { tabs } = get();
        const tabToKeep = tabs.find((t) => t.id === tabId);
        if (tabToKeep) {
          set({ tabs: [tabToKeep], activeTabId: tabId });
        }
      },
    }),
    {
      name: "pdf-annotator-tabs",
    }
  )
);
