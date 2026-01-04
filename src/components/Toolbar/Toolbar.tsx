import { useAnnotationStore, usePdfStore, useUiStore } from "../../stores";
import {
  MousePointer2,
  Pen,
  Highlighter,
  Eraser,
  StickyNote,
  Square,
  ArrowRight,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  FolderOpen,
  Moon,
  Sun,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { AnnotationTool } from "../../types";

const tools: { id: AnnotationTool; icon: typeof Pen; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select (V)" },
  { id: "pen", icon: Pen, label: "Pen (P)" },
  { id: "highlighter", icon: Highlighter, label: "Highlighter (H)" },
  { id: "eraser", icon: Eraser, label: "Eraser (E)" },
  { id: "note", icon: StickyNote, label: "Note (N)" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "arrow", icon: ArrowRight, label: "Arrow" },
];

export function Toolbar() {
  const { currentTool, setCurrentTool, undo, redo, undoStack, redoStack } =
    useAnnotationStore();
  const { zoomLevel, zoomIn, zoomOut, currentPage, totalPages, goToNextPage, goToPreviousPage } =
    usePdfStore();
  const { theme, setTheme } = useUiStore();

  const handleOpenFile = async () => {
    try {
      const filePath = await invoke<string | null>("open_file_dialog");
      if (filePath) {
        const metadata = await invoke<{
          path: string;
          file_name: string;
          page_count: number | null;
          title: string | null;
          author: string | null;
        }>("read_pdf_metadata", { filePath });
        usePdfStore.getState().setFile(filePath, {
          path: metadata.path,
          fileName: metadata.file_name,
          pageCount: metadata.page_count,
          title: metadata.title,
          author: metadata.author,
        });
      }
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  };

  const cycleTheme = () => {
    const nextTheme =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(nextTheme);
  };

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <header className="flex items-center gap-1 px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {/* File operations */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-300 dark:border-gray-600">
        <ToolbarButton
          icon={FolderOpen}
          label="Open file (Ctrl+O)"
          onClick={handleOpenFile}
        />
      </div>

      {/* Annotation tools */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
        {tools.map(({ id, icon, label }) => (
          <ToolbarButton
            key={id}
            icon={icon}
            label={label}
            active={currentTool === id}
            onClick={() => setCurrentTool(id)}
          />
        ))}
      </div>

      {/* Undo/Redo */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
        <ToolbarButton
          icon={Undo2}
          label="Undo (Ctrl+Z)"
          onClick={undo}
          disabled={undoStack.length === 0}
        />
        <ToolbarButton
          icon={Redo2}
          label="Redo (Ctrl+Y)"
          onClick={redo}
          disabled={redoStack.length === 0}
        />
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
        <ToolbarButton icon={ZoomOut} label="Zoom out" onClick={zoomOut} />
        <span className="px-2 text-sm text-gray-700 dark:text-gray-300 min-w-[4rem] text-center">
          {Math.round(zoomLevel * 100)}%
        </span>
        <ToolbarButton icon={ZoomIn} label="Zoom in" onClick={zoomIn} />
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
        <ToolbarButton
          icon={ChevronLeft}
          label="Previous page"
          onClick={goToPreviousPage}
          disabled={currentPage <= 1}
        />
        <span className="px-2 text-sm text-gray-700 dark:text-gray-300 min-w-[5rem] text-center">
          {totalPages > 0 ? `${currentPage} / ${totalPages}` : "- / -"}
        </span>
        <ToolbarButton
          icon={ChevronRight}
          label="Next page"
          onClick={goToNextPage}
          disabled={currentPage >= totalPages}
        />
      </div>

      <div className="flex-1" />

      {/* Theme toggle */}
      <ToolbarButton
        icon={ThemeIcon}
        label={`Theme: ${theme}`}
        onClick={cycleTheme}
      />
    </header>
  );
}

interface ToolbarButtonProps {
  icon: typeof Pen;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded transition-colors ${
        active
          ? "bg-blue-500 text-white"
          : disabled
            ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
      }`}
      title={label}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
