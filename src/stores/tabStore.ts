import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PdfMetadata, ViewMode } from "../types";

// TabState stores per-tab view state
// groupId references a StudyGroup.id from studyGroupStore
export interface TabState {
  id: string;
  filePath: string;
  documentId: string | null; // Reference to Document.id in libraryStore
  metadata: PdfMetadata | null;
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  rotation: number;
  viewMode: ViewMode;
  scrollPosition: number;
  groupId: string | null; // References StudyGroup.id, null means ungrouped
}

interface TabStoreState {
  tabs: TabState[];
  activeTabId: string | null;

  // Tab Actions
  openTab: (filePath: string, metadata: PdfMetadata | null, documentId?: string | null, groupId?: string | null) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<TabState>) => void;
  getActiveTab: () => TabState | null;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  moveTabToGroup: (tabId: string, groupId: string | null) => void;
  getTabsInGroup: (groupId: string | null) => TabState[];
  closeGroupTabs: (groupId: string) => void;
  reorderTab: (tabId: string, targetTabId: string, position: "before" | "after") => void;
}

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useTabStore = create<TabStoreState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      openTab: (filePath, metadata, documentId, groupId) => {
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
          documentId: documentId ?? null,
          metadata,
          currentPage: 1,
          totalPages: 0,
          zoomLevel: 1.0,
          rotation: 0,
          viewMode: "continuous",
          scrollPosition: 0,
          groupId: groupId ?? null,
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

      moveTabToGroup: (tabId, groupId) => {
        const { tabs } = get();
        set({
          tabs: tabs.map((t) =>
            t.id === tabId ? { ...t, groupId } : t
          ),
        });
      },

      getTabsInGroup: (groupId) => {
        const { tabs } = get();
        return tabs.filter((t) => t.groupId === groupId);
      },

      closeGroupTabs: (groupId) => {
        const { tabs, activeTabId } = get();
        const newTabs = tabs.filter((t) => t.groupId !== groupId);

        // If active tab was in this group, switch to first remaining tab
        let newActiveTabId = activeTabId;
        const activeTab = tabs.find((t) => t.id === activeTabId);
        if (activeTab?.groupId === groupId) {
          newActiveTabId = newTabs.length > 0 ? newTabs[0].id : null;
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveTabId,
        });
      },

      reorderTab: (tabId, targetTabId, position) => {
        const { tabs } = get();
        const tabIndex = tabs.findIndex((t) => t.id === tabId);
        const targetIndex = tabs.findIndex((t) => t.id === targetTabId);

        if (tabIndex === -1 || targetIndex === -1 || tabIndex === targetIndex) return;

        const newTabs = [...tabs];
        const [movedTab] = newTabs.splice(tabIndex, 1);

        // Calculate new index after removal
        let newIndex = targetIndex;
        if (tabIndex < targetIndex) {
          newIndex = targetIndex - 1;
        }
        if (position === "after") {
          newIndex += 1;
        }

        newTabs.splice(newIndex, 0, movedTab);
        set({ tabs: newTabs });
      },
    }),
    {
      name: "marginalia-tabs",
    }
  )
);
