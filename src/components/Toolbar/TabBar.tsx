import { useState, useRef, useEffect } from "react";
import { X, FileText, ChevronDown, ChevronRight, FolderPlus } from "lucide-react";
import { useTabStore, useStudyGroupStore, GROUP_COLORS } from "../../stores";
import type { TabState } from "../../stores";
import type { StudyGroup } from "../../types";

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

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop state
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null); // groupId or "ungrouped"
  const [dropTargetTab, setDropTargetTab] = useState<{ tabId: string; position: "before" | "after" } | null>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  // Cleanup global handlers on unmount
  useEffect(() => {
    return () => {
      // Ensure cleanup on unmount
      document.body.classList.remove("tab-dragging");
      if (globalDragHandlerRef.current) {
        document.removeEventListener("dragover", globalDragHandlerRef.current);
        document.removeEventListener("dragenter", globalDragHandlerRef.current);
        globalDragHandlerRef.current = null;
      }
    };
  }, []);

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

  const handleMiddleClick = (e: React.MouseEvent, tabId: string) => {
    if (e.button === 1) {
      e.preventDefault();
      closeTab(tabId);
    }
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

  // Global dragover handler reference for cleanup
  const globalDragHandlerRef = useRef<((e: DragEvent) => void) | null>(null);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    console.log("[TabBar] Drag start, tabId:", tabId);
    e.stopPropagation();
    setDraggingTabId(tabId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tabId);
    // Set drag image
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 10, 10);
    }

    // CRITICAL: Add global handler IMMEDIATELY (synchronously) to prevent forbidden cursor
    // The useEffect approach has a delay which causes the forbidden cursor to appear
    document.body.classList.add("tab-dragging");

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

  const handleDragEnd = () => {
    setDraggingTabId(null);
    setDropTarget(null);
    setDropTargetTab(null);

    // Clean up global handlers
    document.body.classList.remove("tab-dragging");
    if (globalDragHandlerRef.current) {
      document.removeEventListener("dragover", globalDragHandlerRef.current);
      document.removeEventListener("dragenter", globalDragHandlerRef.current);
      globalDragHandlerRef.current = null;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleTabDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    if (!draggingTabId || draggingTabId === tabId) return;

    // Determine if dropping before or after based on mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const position = e.clientX < midpoint ? "before" : "after";
    setDropTargetTab({ tabId, position });
  };

  const handleTabDragLeave = () => {
    setDropTargetTab(null);
  };

  const handleDropOnTab = (e: React.DragEvent, targetTabId: string) => {
    console.log("[TabBar] Drop on tab, targetTabId:", targetTabId);
    e.preventDefault();
    e.stopPropagation();

    const tabId = draggingTabId || e.dataTransfer.getData("text/plain");
    console.log("[TabBar] Drop tabId:", tabId);
    if (!tabId || tabId === targetTabId) {
      handleDragEnd();
      return;
    }

    const draggedTab = tabs.find((t) => t.id === tabId);
    const targetTab = tabs.find((t) => t.id === targetTabId);
    if (!draggedTab || !targetTab) {
      handleDragEnd();
      return;
    }

    // If in same group (or both ungrouped), reorder
    if (draggedTab.groupId === targetTab.groupId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      const position = e.clientX < midpoint ? "before" : "after";
      reorderTab(tabId, targetTabId, position);
    } else {
      // Move to target tab's group
      if (draggedTab.documentId && draggedTab.groupId) {
        removeDocumentFromGroup(draggedTab.groupId, draggedTab.documentId);
      }
      if (targetTab.groupId && draggedTab.documentId) {
        addDocumentToGroup(targetTab.groupId, draggedTab.documentId);
      }
      moveTabToGroup(tabId, targetTab.groupId);
    }

    handleDragEnd();
  };

  const handleDropOnGroup = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const tabId = draggingTabId || e.dataTransfer.getData("text/plain");
    if (!tabId) {
      handleDragEnd();
      return;
    }

    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || tab.groupId === groupId) {
      handleDragEnd();
      return;
    }

    // Remove from old group if needed
    if (tab.documentId && tab.groupId) {
      removeDocumentFromGroup(tab.groupId, tab.documentId);
    }

    // Add to new group
    if (tab.documentId) {
      addDocumentToGroup(groupId, tab.documentId);
    }

    moveTabToGroup(tabId, groupId);
    handleDragEnd();
  };

  const handleDropOnUngrouped = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const tabId = draggingTabId || e.dataTransfer.getData("text/plain");
    if (!tabId) {
      handleDragEnd();
      return;
    }

    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || !tab.groupId) {
      handleDragEnd();
      return;
    }

    // Remove from group
    if (tab.documentId && tab.groupId) {
      removeDocumentFromGroup(tab.groupId, tab.documentId);
    }

    moveTabToGroup(tabId, null);
    handleDragEnd();
  };

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
        draggable="true"
        onDragStart={(e) => handleDragStart(e, tab.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleTabDragOver(e, tab.id)}
        onDragLeave={handleTabDragLeave}
        onDrop={(e) => handleDropOnTab(e, tab.id)}
        onClick={() => !isDragging && handleTabClick(tab)}
        onMouseDown={(e) => handleMiddleClick(e, tab.id)}
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
          draggable="false"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
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
        className={`flex items-center transition-all ${isDropTarget && !isDraggingFromThisGroup ? 'scale-105' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={(e) => {
          e.preventDefault();
          setDropTarget(group.id);
        }}
        onDragLeave={(e) => {
          // Only clear if leaving the group entirely
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropTarget(null);
          }
        }}
        onDrop={(e) => handleDropOnGroup(e, group.id)}
      >
        {/* Group header */}
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-t-md mt-1 cursor-pointer border-b-2 transition-all ${
            isDropTarget && !isDraggingFromThisGroup ? "ring-2 ring-blue-400 ring-offset-1 shadow-lg" : ""
          }`}
          style={{ ...bgStyle, ...borderStyle }}
          onClick={() => toggleGroupCollapsed(group.id)}
          onDragOver={handleDragOver}
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
              <div className="absolute top-full left-0 mt-1 hidden group-hover/color:flex gap-1 p-1 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-600 z-50">
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
      className="flex items-center bg-gray-200 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 overflow-x-auto"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        // Fallback handler for drops that don't land on specific zones
        e.preventDefault();
        handleDragEnd();
      }}
    >
      {/* Grouped tabs */}
      {studyGroups.map((group) => renderGroupHeader(group))}

      {/* Ungrouped tabs - also a drop zone */}
      <div
        className={`flex items-center flex-1 min-h-[36px] transition-all rounded-lg mx-1 ${
          dropTarget === "ungrouped" && draggingTabId && tabs.find(t => t.id === draggingTabId)?.groupId
            ? "bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400 ring-inset"
            : ""
        }`}
        onDragOver={handleDragOver}
        onDragEnter={(e) => {
          e.preventDefault();
          setDropTarget("ungrouped");
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropTarget(null);
          }
        }}
        onDrop={handleDropOnUngrouped}
      >
        {ungroupedTabs.map((tab) => renderTab(tab))}
        {/* Explicit drop zone for ungrouping - always visible when dragging grouped tab */}
        {draggingTabId && tabs.find(t => t.id === draggingTabId)?.groupId && (
          <div
            className="flex items-center px-3 py-1 mx-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-2 border-dashed border-blue-400 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDropOnUngrouped(e);
            }}
          >
            Drop here to ungroup
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
