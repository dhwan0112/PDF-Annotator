import { useUiStore } from "../../stores";
import {
  FileText,
  Bookmark,
  MessageSquare,
  List,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ThumbnailPanel } from "./ThumbnailPanel";
import { BookmarkPanel } from "./BookmarkPanel";
import type { PDFDocumentProxy } from "pdfjs-dist";

const panels = [
  { id: "thumbnails" as const, icon: FileText, label: "Thumbnails" },
  { id: "bookmarks" as const, icon: Bookmark, label: "Bookmarks" },
  { id: "annotations" as const, icon: MessageSquare, label: "Annotations" },
  { id: "outline" as const, icon: List, label: "Outline" },
];

interface SidebarProps {
  pdfDocument?: PDFDocumentProxy | null;
}

export function Sidebar({ pdfDocument }: SidebarProps) {
  const {
    sidebarVisible,
    sidebarWidth,
    activePanel,
    toggleSidebar,
    setActivePanel,
  } = useUiStore();

  if (!sidebarVisible) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-10 bg-gray-100 dark:bg-gray-800 p-2 rounded-r-lg shadow-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        title="Show sidebar"
      >
        <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </button>
    );
  }

  return (
    <aside
      className="flex flex-shrink-0 h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700"
      style={{ width: sidebarWidth }}
    >
      {/* Panel tabs */}
      <div className="flex flex-col w-12 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        {panels.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            className={`p-3 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
              activePanel === id
                ? "bg-gray-200 dark:bg-gray-700 text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400"
            }`}
            title={label}
          >
            <Icon className="w-5 h-5" />
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={toggleSidebar}
          className="p-3 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
          title="Hide sidebar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 capitalize">
            {activePanel}
          </h2>
        </div>
        <div className="flex-1 overflow-hidden">
          {activePanel === "thumbnails" && (
            <div className="h-full overflow-auto p-2">
              <ThumbnailPanel pdfDocument={pdfDocument ?? null} />
            </div>
          )}
          {activePanel === "bookmarks" && <BookmarkPanel />}
          {activePanel === "annotations" && (
            <div className="p-2"><AnnotationsPanel /></div>
          )}
          {activePanel === "outline" && (
            <div className="p-2"><OutlinePanel /></div>
          )}
        </div>
      </div>
    </aside>
  );
}

function AnnotationsPanel() {
  return (
    <div className="text-gray-500 dark:text-gray-400 text-sm p-2">
      Annotations will appear here.
    </div>
  );
}

function OutlinePanel() {
  return (
    <div className="text-gray-500 dark:text-gray-400 text-sm p-2">
      Document outline will appear here when a PDF is loaded.
    </div>
  );
}
