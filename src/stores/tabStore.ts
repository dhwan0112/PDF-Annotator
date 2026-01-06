import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PdfMetadata, ViewMode } from "../types";

// Preset colors for tab groups
export const TAB_GROUP_COLORS = [
  { name: "gray", bg: "bg-gray-200 dark:bg-gray-700", border: "border-gray-400", text: "text-gray-700 dark:text-gray-300" },
  { name: "red", bg: "bg-red-200 dark:bg-red-900/50", border: "border-red-400", text: "text-red-700 dark:text-red-300" },
  { name: "orange", bg: "bg-orange-200 dark:bg-orange-900/50", border: "border-orange-400", text: "text-orange-700 dark:text-orange-300" },
  { name: "yellow", bg: "bg-yellow-200 dark:bg-yellow-900/50", border: "border-yellow-400", text: "text-yellow-700 dark:text-yellow-300" },
  { name: "green", bg: "bg-green-200 dark:bg-green-900/50", border: "border-green-400", text: "text-green-700 dark:text-green-300" },
  { name: "blue", bg: "bg-blue-200 dark:bg-blue-900/50", border: "border-blue-400", text: "text-blue-700 dark:text-blue-300" },
  { name: "purple", bg: "bg-purple-200 dark:bg-purple-900/50", border: "border-purple-400", text: "text-purple-700 dark:text-purple-300" },
  { name: "pink", bg: "bg-pink-200 dark:bg-pink-900/50", border: "border-pink-400", text: "text-pink-700 dark:text-pink-300" },
];

export interface TabGroup {
  id: string;
  name: string;
  colorIndex: number; // Index into TAB_GROUP_COLORS
  collapsed: boolean;
}

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
  groupId: string | null; // null means ungrouped
}

interface TabStoreState {
  tabs: TabState[];
  groups: TabGroup[];
  activeTabId: string | null;

  // Tab Actions
  openTab: (filePath: string, metadata: PdfMetadata | null, groupId?: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<TabState>) => void;
  getActiveTab: () => TabState | null;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  moveTabToGroup: (tabId: string, groupId: string | null) => void;

  // Group Actions
  createGroup: (name: string, colorIndex?: number) => string;
  updateGroup: (groupId: string, updates: Partial<Omit<TabGroup, "id">>) => void;
  deleteGroup: (groupId: string) => void;
  toggleGroupCollapsed: (groupId: string) => void;
  getTabsInGroup: (groupId: string | null) => TabState[];
  closeGroupTabs: (groupId: string) => void;
}

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateGroupId(): string {
  return `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useTabStore = create<TabStoreState>()(
  persist(
    (set, get) => ({
      tabs: [],
      groups: [],
      activeTabId: null,

      openTab: (filePath, metadata, groupId) => {
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

      // Group Actions
      createGroup: (name, colorIndex = 0) => {
        const newGroup: TabGroup = {
          id: generateGroupId(),
          name,
          colorIndex: colorIndex % TAB_GROUP_COLORS.length,
          collapsed: false,
        };

        set((state) => ({
          groups: [...state.groups, newGroup],
        }));

        return newGroup.id;
      },

      updateGroup: (groupId, updates) => {
        const { groups } = get();
        set({
          groups: groups.map((g) =>
            g.id === groupId ? { ...g, ...updates } : g
          ),
        });
      },

      deleteGroup: (groupId) => {
        const { groups, tabs } = get();
        // Remove group and ungroup all tabs in it
        set({
          groups: groups.filter((g) => g.id !== groupId),
          tabs: tabs.map((t) =>
            t.groupId === groupId ? { ...t, groupId: null } : t
          ),
        });
      },

      toggleGroupCollapsed: (groupId) => {
        const { groups } = get();
        set({
          groups: groups.map((g) =>
            g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
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
    }),
    {
      name: "pdf-annotator-tabs",
    }
  )
);
