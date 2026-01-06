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

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

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

  // Organize tabs by group
  const ungroupedTabs = tabs.filter((t) => !t.groupId);
  const groupedTabs = new Map<string, TabState[]>();
  studyGroups.forEach((g) => {
    groupedTabs.set(g.id, tabs.filter((t) => t.groupId === g.id));
  });

  const renderTab = (tab: TabState, group?: StudyGroup) => {
    const isActive = tab.id === activeTabId;
    const fileName = tab.filePath.split(/[\\/]/).pop() || "Untitled";
    const displayName = fileName.length > 20 ? fileName.substring(0, 17) + "..." : fileName;
    const groupColor = group?.color;

    // Generate styles based on hex color
    const bgStyle = groupColor ? { backgroundColor: `${groupColor}20` } : undefined;
    const borderStyle = groupColor ? { borderColor: groupColor } : undefined;
    const textStyle = groupColor ? { color: groupColor } : undefined;

    return (
      <div
        key={tab.id}
        onClick={() => handleTabClick(tab)}
        onMouseDown={(e) => handleMiddleClick(e, tab.id)}
        onContextMenu={(e) => handleContextMenu(e, tab.id)}
        className={`group flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer min-w-0 max-w-[180px] transition-colors ${
          isActive
            ? "bg-white dark:bg-gray-800 rounded-t-lg border-t border-l border-r -mb-px"
            : "hover:bg-gray-50 dark:hover:bg-gray-800 rounded-t-md mt-1 mx-0.5 border border-transparent"
        } ${!isActive && !groupColor ? "bg-gray-100 dark:bg-gray-850" : ""}`}
        style={isActive ? borderStyle : bgStyle}
        title={tab.filePath}
      >
        <FileText
          className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-blue-500" : !groupColor ? "text-gray-500 dark:text-gray-400" : ""}`}
          style={!isActive && groupColor ? textStyle : undefined}
        />
        <span
          className={`truncate text-xs ${isActive ? "text-gray-900 dark:text-gray-100 font-medium" : !groupColor ? "text-gray-600 dark:text-gray-400" : ""}`}
          style={!isActive && groupColor ? textStyle : undefined}
        >
          {displayName}
        </span>
        <button
          onClick={(e) => handleCloseTab(e, tab.id)}
          className={`p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          title="Close tab"
        >
          <X className="w-3 h-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
        </button>
      </div>
    );
  };

  const renderGroupHeader = (group: StudyGroup) => {
    const tabsInGroup = groupedTabs.get(group.id) || [];

    if (tabsInGroup.length === 0) return null;

    const groupColor = group.color;
    const bgStyle = { backgroundColor: `${groupColor}20` };
    const borderStyle = { borderColor: groupColor };
    const textStyle = { color: groupColor };

    return (
      <div key={`group-${group.id}`} className="flex items-center">
        {/* Group header */}
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-t-md mt-1 cursor-pointer border-b-2"
          style={{ ...bgStyle, ...borderStyle }}
          onClick={() => toggleGroupCollapsed(group.id)}
        >
          {group.collapsed ? (
            <ChevronRight className="w-3 h-3" style={textStyle} />
          ) : (
            <ChevronDown className="w-3 h-3" style={textStyle} />
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
              className="text-xs font-medium"
              style={textStyle}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingGroupId(group.id);
                setEditingName(group.name);
              }}
            >
              {group.name}
            </span>
          )}
          <span className="text-xs opacity-60" style={textStyle}>({tabsInGroup.length})</span>
          {/* Color picker */}
          <div className="relative group/color ml-1">
            <div
              className="w-3 h-3 rounded-full border"
              style={{ backgroundColor: groupColor, borderColor: groupColor }}
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
          {/* Close group button */}
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
            <X className="w-3 h-3" style={textStyle} />
          </button>
        </div>
        {/* Group tabs */}
        {!group.collapsed && tabsInGroup.map((tab) => renderTab(tab, group))}
      </div>
    );
  };

  return (
    <div className="flex items-center bg-gray-200 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 overflow-x-auto">
      {/* Grouped tabs */}
      {studyGroups.map((group) => renderGroupHeader(group))}

      {/* Ungrouped tabs */}
      {ungroupedTabs.map((tab) => renderTab(tab))}

      {/* Empty space filler */}
      <div className="flex-1 border-b border-gray-300 dark:border-gray-600" />

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
