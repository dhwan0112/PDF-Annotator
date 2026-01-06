import { X, FileText } from "lucide-react";
import { useTabStore } from "../../stores";
import type { TabState } from "../../stores";

interface TabBarProps {
  onTabChange?: (tab: TabState) => void;
}

export function TabBar({ onTabChange }: TabBarProps) {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabStore();

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

  return (
    <div className="flex items-center bg-gray-200 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const fileName = tab.filePath.split(/[\\/]/).pop() || "Untitled";
        const displayName = fileName.length > 25 ? fileName.substring(0, 22) + "..." : fileName;

        return (
          <div
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            onMouseDown={(e) => handleMiddleClick(e, tab.id)}
            className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer min-w-0 max-w-[200px] transition-colors ${
              isActive
                ? "bg-white dark:bg-gray-800 rounded-t-lg border-t border-l border-r border-gray-300 dark:border-gray-600 -mb-px"
                : "bg-gray-100 dark:bg-gray-850 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-t-md mt-1 mx-0.5 border border-transparent"
            }`}
            title={tab.filePath}
          >
            <FileText className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-blue-500" : "text-gray-500 dark:text-gray-400"}`} />
            <span className={`truncate text-sm ${isActive ? "text-gray-900 dark:text-gray-100 font-medium" : "text-gray-600 dark:text-gray-400"}`}>
              {displayName}
            </span>
            <button
              onClick={(e) => handleCloseTab(e, tab.id)}
              className={`p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 ${
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              title="Close tab"
            >
              <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
            </button>
          </div>
        );
      })}
      {/* Empty space filler */}
      <div className="flex-1 border-b border-gray-300 dark:border-gray-600" />
    </div>
  );
}
