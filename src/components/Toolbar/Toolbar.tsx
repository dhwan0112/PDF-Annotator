import { useState, useRef } from "react";
import { useAnnotationStore, usePdfStore, useUiStore } from "../../stores";
import {
  MousePointer2,
  Pen,
  Highlighter,
  Eraser,
  StickyNote,
  Square,
  ArrowRight,
  ArrowLeft,
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
  RotateCw,
  RotateCcw,
  Rows,
  File,
  Underline,
  Strikethrough,
  Library,
  Settings2,
  Keyboard,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { AnnotationTool } from "../../types";
import { ToolSettingsPopover } from "./ToolSettingsPopover";
import { KeyboardShortcutsSettings } from "../Settings";

const tools: { id: AnnotationTool; icon: typeof Pen; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select (V)" },
  { id: "pen", icon: Pen, label: "Pen (P)" },
  { id: "highlighter", icon: Highlighter, label: "Highlighter (H)" },
  { id: "underline", icon: Underline, label: "Underline (U)" },
  { id: "strikeout", icon: Strikethrough, label: "Strikeout (S)" },
  { id: "eraser", icon: Eraser, label: "Eraser (E)" },
  { id: "note", icon: StickyNote, label: "Note (N)" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "arrow", icon: ArrowRight, label: "Arrow" },
];

export function Toolbar() {
  const { currentTool, setCurrentTool, undo, redo, undoStack, redoStack, getToolSettings } =
    useAnnotationStore();
  const {
    zoomLevel,
    zoomIn,
    zoomOut,
    currentPage,
    totalPages,
    goToNextPage,
    goToPreviousPage,
    rotateClockwise,
    rotateCounterClockwise,
    viewMode,
    setViewMode,
  } = usePdfStore();
  const { theme, setTheme, currentView, setCurrentView, marginNotesVisible, toggleMarginNotes } = useUiStore();

  const [settingsPopoverTool, setSettingsPopoverTool] = useState<AnnotationTool | null>(null);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<HTMLElement | null>(null);
  const [showKeyboardSettings, setShowKeyboardSettings] = useState(false);
  const toolButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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
        setCurrentView("viewer");
      }
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  };

  const handleBackToLibrary = () => {
    setCurrentView("library");
  };

  const cycleTheme = () => {
    const nextTheme =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(nextTheme);
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === "continuous" ? "single" : "continuous");
  };

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  // Library view toolbar
  if (currentView === "library") {
    return (
      <header className="flex items-center gap-1 px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* Logo/Title */}
        <div className="flex items-center gap-2 px-2">
          <Library className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-gray-800 dark:text-gray-200">PDF Annotator</span>
        </div>

        {/* Open file */}
        <div className="flex items-center gap-1 px-2 border-l border-gray-300 dark:border-gray-600">
          <ToolbarButton
            icon={FolderOpen}
            label="Open file (Ctrl+O)"
            onClick={handleOpenFile}
          />
        </div>

        <div className="flex-1" />

        {/* Keyboard shortcuts settings */}
        <ToolbarButton
          icon={Keyboard}
          label="Keyboard shortcuts"
          onClick={() => setShowKeyboardSettings(true)}
        />

        {/* Theme toggle */}
        <ToolbarButton
          icon={ThemeIcon}
          label={`Theme: ${theme}`}
          onClick={cycleTheme}
        />

        {/* Keyboard shortcuts settings modal */}
        {showKeyboardSettings && (
          <KeyboardShortcutsSettings onClose={() => setShowKeyboardSettings(false)} />
        )}
      </header>
    );
  }

  // Viewer toolbar
  return (
    <header className="flex items-center gap-1 px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap">
      {/* Back to library */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-300 dark:border-gray-600">
        <ToolbarButton
          icon={ArrowLeft}
          label="Back to Library (Esc)"
          onClick={handleBackToLibrary}
        />
        <ToolbarButton
          icon={FolderOpen}
          label="Open file (Ctrl+O)"
          onClick={handleOpenFile}
        />
      </div>

      {/* Annotation tools */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
        {tools.map(({ id, icon: Icon, label }) => {
          const settings = getToolSettings(id);
          const showColorIndicator = id !== "select" && id !== "eraser";
          return (
            <div key={id} className="relative">
              <button
                ref={(el) => {
                  if (el) toolButtonRefs.current.set(id, el);
                }}
                onClick={() => setCurrentTool(id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSettingsPopoverTool(id);
                  setSettingsAnchorEl(toolButtonRefs.current.get(id) || null);
                }}
                onDoubleClick={() => {
                  setSettingsPopoverTool(id);
                  setSettingsAnchorEl(toolButtonRefs.current.get(id) || null);
                }}
                className={`p-2 rounded transition-colors relative ${
                  currentTool === id
                    ? "bg-blue-500 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
                title={`${label} (Right-click for settings)`}
              >
                <Icon className="w-5 h-5" />
                {/* Color indicator dot */}
                {showColorIndicator && (
                  <div
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-gray-300 dark:border-gray-600"
                    style={{ backgroundColor: settings.color }}
                  />
                )}
              </button>
            </div>
          );
        })}
        {/* Settings button for current tool */}
        {currentTool !== "select" && (
          <button
            onClick={() => {
              setSettingsPopoverTool(currentTool);
              setSettingsAnchorEl(toolButtonRefs.current.get(currentTool) || null);
            }}
            className="p-2 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Tool settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tool settings popover */}
      {settingsPopoverTool && (
        <ToolSettingsPopover
          tool={settingsPopoverTool}
          anchorEl={settingsAnchorEl}
          onClose={() => {
            setSettingsPopoverTool(null);
            setSettingsAnchorEl(null);
          }}
        />
      )}

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

      {/* View controls */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
        <ToolbarButton
          icon={viewMode === "continuous" ? Rows : File}
          label={viewMode === "continuous" ? "Single page mode" : "Continuous mode"}
          onClick={toggleViewMode}
        />
        <ToolbarButton
          icon={RotateCcw}
          label="Rotate counter-clockwise"
          onClick={rotateCounterClockwise}
        />
        <ToolbarButton
          icon={RotateCw}
          label="Rotate clockwise"
          onClick={rotateClockwise}
        />
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
        <ToolbarButton icon={ZoomOut} label="Zoom out (-)" onClick={zoomOut} />
        <span className="px-2 text-sm text-gray-700 dark:text-gray-300 min-w-[4rem] text-center">
          {Math.round(zoomLevel * 100)}%
        </span>
        <ToolbarButton icon={ZoomIn} label="Zoom in (+)" onClick={zoomIn} />
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-300 dark:border-gray-600">
        <ToolbarButton
          icon={ChevronLeft}
          label="Previous page (Page Up)"
          onClick={goToPreviousPage}
          disabled={currentPage <= 1}
        />
        <span className="px-2 text-sm text-gray-700 dark:text-gray-300 min-w-[5rem] text-center">
          {totalPages > 0 ? `${currentPage} / ${totalPages}` : "- / -"}
        </span>
        <ToolbarButton
          icon={ChevronRight}
          label="Next page (Page Down)"
          onClick={goToNextPage}
          disabled={currentPage >= totalPages}
        />
      </div>

      <div className="flex-1" />

      {/* Margin Notes toggle */}
      <ToolbarButton
        icon={marginNotesVisible ? PanelRightClose : PanelRightOpen}
        label={marginNotesVisible ? "Hide margin notes" : "Show margin notes"}
        active={marginNotesVisible}
        onClick={toggleMarginNotes}
      />

      {/* Keyboard shortcuts settings */}
      <ToolbarButton
        icon={Keyboard}
        label="Keyboard shortcuts"
        onClick={() => setShowKeyboardSettings(true)}
      />

      {/* Theme toggle */}
      <ToolbarButton
        icon={ThemeIcon}
        label={`Theme: ${theme}`}
        onClick={cycleTheme}
      />

      {/* Keyboard shortcuts settings modal */}
      {showKeyboardSettings && (
        <KeyboardShortcutsSettings onClose={() => setShowKeyboardSettings(false)} />
      )}
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
