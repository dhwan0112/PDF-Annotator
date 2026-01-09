import { useState, useRef, useEffect, useCallback } from "react";
import { X, FileText, ChevronDown, ChevronRight, FolderPlus } from "lucide-react";
import { useTabStore, useStudyGroupStore, GROUP_COLORS } from "../../stores";
import { useDrag } from "../../contexts";
import type { TabState } from "../../stores";
import type { StudyGroup } from "../../types";
import type { DragData, TabDragData } from "../../contexts";

interface TabBarProps {
  onTabChange?: (tab: TabState) => void;
}

export function TabBar({ onTabChange }: TabBarProps) {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    moveTabToGroup,
    closeGroupTabs,
    reorderTab,
  } = useTabStore();

  const {
    studyGroups,
    createStudyGroup,
    updateStudyGroup,
    deleteStudyGroup,
    toggleGroupCollapsed,
    addDocumentToGroup,
    removeDocumentFromGroup,
  } = useStudyGroupStore();

  // Custom drag system
  const { dragState, startDrag, registerDropZone, unregisterDropZone } = useDrag();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Local drag state for visual feedback
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dropTargetTab, setDropTargetTab] = useState<{ tabId: string; position: "before" | "after" } | null>(null);

  // Get dragging tab ID from drag context
  const draggingTabId = dragState.isDragging && dragState.dragData?.type === "tab"
    ? (dragState.dragData as TabDragData).tabId
    : null;

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  // Clear visual state when drag ends
  useEffect(() => {
    if (!dragState.isDragging) {
      setDropTarget(null);
      setDropTargetTab(null);
    }
  }, [dragState.isDragging]);

  // Focus input when editing group name
  useEffect(() => {
    if (editingGroupId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingGroupId]);

  if (tabs.length === 0) {
    return null;
  }

  const handleTabClick = (tab: TabState) => {
    setActiveTab(tab.id);
    onTabChange?.(tab);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const handleCreateNewGroup = () => {
    if (!contextMenu) return;
    const tab = tabs.find((t) => t.id === contextMenu.tabId);
    if (!tab) return;

    // Create new study group with a random color
    const colorIndex = studyGroups.length % GROUP_COLORS.length;
    const groupId = createStudyGroup("New Group", undefined, GROUP_COLORS[colorIndex]);

    // Add document to group if it has a documentId
    if (tab.documentId) {
      addDocumentToGroup(groupId, tab.documentId);
    }

    // Update tab's groupId
    moveTabToGroup(contextMenu.tabId, groupId);
    setContextMenu(null);

    // Start editing the group name
    setEditingGroupId(groupId);
    setEditingName("New Group");
  };

  const handleAddToGroup = (groupId: string) => {
    if (!contextMenu) return;
    const tab = tabs.find((t) => t.id === contextMenu.tabId);
    if (!tab) return;

    // Add document to study group if it has a documentId
    if (tab.documentId) {
      addDocumentToGroup(groupId, tab.documentId);
    }

    moveTabToGroup(contextMenu.tabId, groupId);
    setContextMenu(null);
  };

  const handleRemoveFromGroup = () => {
    if (!contextMenu) return;
    const tab = tabs.find((t) => t.id === contextMenu.tabId);
    if (!tab) return;

    // Remove document from study group if it has a documentId and groupId
    if (tab.documentId && tab.groupId) {
      removeDocumentFromGroup(tab.groupId, tab.documentId);
    }

    moveTabToGroup(contextMenu.tabId, null);
    setContextMenu(null);
  };

  const handleGroupNameSubmit = (groupId: string) => {
    if (editingName.trim()) {
      updateStudyGroup(groupId, { name: editingName.trim() });
    }
    setEditingGroupId(null);
  };

  const handleGroupColorChange = (groupId: string, color: string) => {
    updateStudyGroup(groupId, { color });
  };

  // Mouse-based drag handlers (replaces HTML5 drag-and-drop)
  const handleTabMouseDown = (e: React.MouseEvent, tabId: string) => {
    // Only left mouse button
    if (e.button !== 0) return;
    // Don't start drag on close button
    if ((e.target as HTMLElement).closest("button")) return;

    // Start pending drag - don't prevent default so onClick still fires
    // Tab selection is handled by onClick, not onCancel callback
    startDrag({ type: "tab", tabId }, e.clientX, e.clientY);
  };

  // Handle tab drop
  const handleTabDrop = useCallback((data: DragData) => {
    if (!data || data.type !== "tab") return;

    const tabId = data.tabId;
    const pos = dragState.position;

    // Find which element we're over
    const elements = document.elementsFromPoint(pos.x, pos.y);

    // Check for tab drop
    const tabElement = elements.find(el => el.getAttribute("data-tab-id"));
    if (tabElement) {
      const targetTabId = tabElement.getAttribute("data-tab-id");
      if (targetTabId && tabId !== targetTabId) {
        const draggedTab = tabs.find((t) => t.id === tabId);
        const targetTab = tabs.find((t) => t.id === targetTabId);
        if (draggedTab && targetTab) {
          if (draggedTab.groupId === targetTab.groupId) {
            const rect = tabElement.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            const dropPosition = pos.x < midpoint ? "before" : "after";
            reorderTab(tabId, targetTabId, dropPosition);
          } else {
            if (draggedTab.documentId && draggedTab.groupId) {
              removeDocumentFromGroup(draggedTab.groupId, draggedTab.documentId);
            }
            if (targetTab.groupId && draggedTab.documentId) {
              addDocumentToGroup(targetTab.groupId, draggedTab.documentId);
            }
            moveTabToGroup(tabId, targetTab.groupId);
          }
        }
      }
      return;
    }

    // Check for group drop
    const groupElement = elements.find(el => el.getAttribute("data-group-id"));
    if (groupElement) {
      const groupId = groupElement.getAttribute("data-group-id");
      if (groupId) {
        const tab = tabs.find((t) => t.id === tabId);
        if (tab && tab.groupId !== groupId) {
          if (tab.documentId && tab.groupId) {
            removeDocumentFromGroup(tab.groupId, tab.documentId);
          }
          if (tab.documentId) {
            addDocumentToGroup(groupId, tab.documentId);
          }
          moveTabToGroup(tabId, groupId);
        }
      }
      return;
    }

    // Check for ungrouped zone
    const ungroupedZone = elements.find(el => el.getAttribute("data-zone") === "ungrouped");
    if (ungroupedZone) {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab && tab.groupId) {
        if (tab.documentId && tab.groupId) {
          removeDocumentFromGroup(tab.groupId, tab.documentId);
        }
        moveTabToGroup(tabId, null);
      }
    }
  }, [tabs, dragState.position, reorderTab, moveTabToGroup, addDocumentToGroup, removeDocumentFromGroup]);

  // Register drop zone for tab bar
  const tabBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabBarRef.current;
    if (el) {
      registerDropZone("tabbar", el, handleTabDrop);
      return () => unregisterDropZone("tabbar");
    }
  }, [registerDropZone, unregisterDropZone, handleTabDrop]);

  // Organize tabs by group
  const ungroupedTabs = tabs.filter((t) => !t.groupId);
  const groupedTabs = new Map<string, TabState[]>();
  studyGroups.forEach((g) => {
    groupedTabs.set(g.id, tabs.filter((t) => t.groupId === g.id));
  });

  const renderTab = (tab: TabState, group?: StudyGroup) => {
    const isActive = tab.id === activeTabId;
    const isDragging = tab.id === draggingTabId;
    const fileName = tab.filePath.split(/[\\/]/).pop() || "Untitled";
    const displayName = fileName.length > 20 ? fileName.substring(0, 17) + "..." : fileName;
    const groupColor = group?.color;
    const isDropTargetBefore = dropTargetTab?.tabId === tab.id && dropTargetTab?.position === "before";
    const isDropTargetAfter = dropTargetTab?.tabId === tab.id && dropTargetTab?.position === "after";

    // Generate styles based on hex color
    const bgStyle = groupColor ? { backgroundColor: `${groupColor}20` } : undefined;
    const borderStyle = groupColor ? { borderColor: groupColor } : undefined;
    const textStyle = groupColor ? { color: groupColor } : undefined;

    return (
      <div
        key={tab.id}
        data-tab-id={tab.id}
        onMouseDown={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            closeTab(tab.id);
          } else {
            handleTabMouseDown(e, tab.id);
          }
        }}
        onClick={() => !isDragging && handleTabClick(tab)}
        onContextMenu={(e) => handleContextMenu(e, tab.id)}
        className={`group flex items-center gap-1.5 px-2.5 py-1.5 cursor-grab active:cursor-grabbing min-w-0 max-w-[180px] transition-all select-none relative ${
          isActive
            ? "bg-gray-100 dark:bg-gray-800 rounded-t-lg border-t border-l border-r border-gray-300 dark:border-gray-600 -mb-px"
            : "hover:bg-gray-300 dark:hover:bg-gray-700 rounded-t-md mt-1 mx-0.5 border border-transparent"
        } ${!isActive && !groupColor ? "bg-gray-300/50 dark:bg-gray-800/50" : ""} ${isDragging ? "opacity-40 scale-95" : ""}`}
        style={isActive ? borderStyle : bgStyle}
        title={tab.filePath}
      >
        {/* Drop indicator - before */}
        {isDropTargetBefore && (
          <div className="absolute -left-1 top-0 bottom-0 w-1 bg-blue-500 rounded-full pointer-events-none" />
        )}
        {/* Drop indicator - after */}
        {isDropTargetAfter && (
          <div className="absolute -right-1 top-0 bottom-0 w-1 bg-blue-500 rounded-full pointer-events-none" />
        )}
        <FileText
          className={`w-3.5 h-3.5 flex-shrink-0 pointer-events-none ${isActive ? "text-blue-500" : !groupColor ? "text-gray-500 dark:text-gray-400" : ""}`}
          style={!isActive && groupColor ? textStyle : undefined}
        />
        <span
          className={`truncate text-xs pointer-events-none ${isActive ? "text-gray-900 dark:text-gray-100 font-medium" : !groupColor ? "text-gray-600 dark:text-gray-400" : ""}`}
          style={!isActive && groupColor ? textStyle : undefined}
        >
          {displayName}
        </span>
        <button
          onClick={(e) => handleCloseTab(e, tab.id)}
          onMouseDown={(e) => e.stopPropagation()}
          className={`p-0.5 rounded hover:bg-gray-400 dark:hover:bg-gray-600 ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          title="Close tab"
        >
          <X className="w-3 h-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 pointer-events-none" />
        </button>
      </div>
    );
  };

  const renderGroupHeader = (group: StudyGroup) => {
    const tabsInGroup = groupedTabs.get(group.id) || [];
    const isDropTarget = dropTarget === group.id;
    // Check if dragging tab is from this group
    const isDraggingFromThisGroup = draggingTabId && tabs.find(t => t.id === draggingTabId)?.groupId === group.id;

    if (tabsInGroup.length === 0 && !draggingTabId) return null;

    const groupColor = group.color;
    const bgStyle = { backgroundColor: `${groupColor}${isDropTarget ? '40' : '20'}` };
    const borderStyle = { borderColor: groupColor };
    const textStyle = { color: groupColor };

    return (
      <div
        key={`group-${group.id}`}
        data-group-id={group.id}
        className={`flex items-center transition-all ${isDropTarget && !isDraggingFromThisGroup ? 'scale-105' : ''}`}
      >
        {/* Group header */}
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-t-md mt-1 cursor-pointer border-b-2 transition-all ${
            isDropTarget && !isDraggingFromThisGroup ? "ring-2 ring-blue-400 ring-offset-1 shadow-lg" : ""
          }`}
          style={{ ...bgStyle, ...borderStyle }}
          onClick={() => toggleGroupCollapsed(group.id)}
        >
          {group.collapsed ? (
            <ChevronRight className="w-3 h-3 pointer-events-none" style={textStyle} />
          ) : (
            <ChevronDown className="w-3 h-3 pointer-events-none" style={textStyle} />
          )}
          {editingGroupId === group.id ? (
            <input
              ref={editInputRef}
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => handleGroupNameSubmit(group.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleGroupNameSubmit(group.id);
                if (e.key === "Escape") setEditingGroupId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-20 px-1 text-xs bg-transparent border-b border-current outline-none"
              style={textStyle}
            />
          ) : (
            <span
              className="text-xs font-medium pointer-events-none"
              style={textStyle}
            >
              {group.name}
            </span>
          )}
          <span className="text-xs opacity-60 pointer-events-none" style={textStyle}>({tabsInGroup.length})</span>
          {/* Color picker - hide during drag */}
          {!draggingTabId && (
            <div className="relative group/color ml-1">
              <div
                className="w-3 h-3 rounded-full border"
                style={{ backgroundColor: groupColor, borderColor: groupColor }}
                onDoubleClick={(e) => e.stopPropagation()}
              />
              <div className="absolute top-full left-0 mt-1 hidden group-hover/color:flex gap-1 p-1 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-600 z-[100]">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGroupColorChange(group.id, c);
                    }}
                    className="w-4 h-4 rounded-full border hover:scale-110 transition-transform"
                    style={{ backgroundColor: c, borderColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
          {/* Close group button - hide during drag */}
          {!draggingTabId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Close all ${tabsInGroup.length} tabs in "${group.name}"?`)) {
                  closeGroupTabs(group.id);
                  deleteStudyGroup(group.id);
                }
              }}
              className="ml-1 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100"
              title="Close group"
            >
              <X className="w-3 h-3 pointer-events-none" style={textStyle} />
            </button>
          )}
        </div>
        {/* Group tabs */}
        {!group.collapsed && tabsInGroup.map((tab) => renderTab(tab, group))}
      </div>
    );
  };

  return (
    <div
      ref={tabBarRef}
      className="flex items-center bg-gray-200 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 overflow-x-auto"
    >
      {/* Grouped tabs */}
      {studyGroups.map((group) => renderGroupHeader(group))}

      {/* Ungrouped tabs - also a drop zone */}
      <div
        data-zone="ungrouped"
        className={`flex items-center flex-1 min-h-[36px] transition-all rounded-lg mx-1 ${
          dropTarget === "ungrouped" && draggingTabId && tabs.find(t => t.id === draggingTabId)?.groupId
            ? "bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400 ring-inset"
            : ""
        }`}
      >
        {ungroupedTabs.map((tab) => renderTab(tab))}
        {/* Explicit drop zone for ungrouping - always visible when dragging grouped tab */}
        {draggingTabId && tabs.find(t => t.id === draggingTabId)?.groupId && (
          <div
            data-zone="ungrouped"
            className="flex items-center px-3 py-1 mx-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-2 border-dashed border-blue-400 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50"
          >
            여기에 드롭하여 그룹 해제
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCreateNewGroup}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <FolderPlus className="w-4 h-4" />
            Add to new group
          </button>
          {studyGroups.length > 0 && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              {studyGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleAddToGroup(group.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <div
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: group.color, borderColor: group.color }}
                  />
                  {group.name}
                </button>
              ))}
            </>
          )}
          {tabs.find((t) => t.id === contextMenu.tabId)?.groupId && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              <button
                onClick={handleRemoveFromGroup}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-4 h-4" />
                Remove from group
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
