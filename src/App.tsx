import { useEffect, useCallback, useState, useRef } from "react";
import { Toolbar, TabBar } from "./components/Toolbar";
import { Sidebar } from "./components/Sidebar";
import { PdfViewer } from "./components/PdfViewer";
import { Library } from "./components/Library";
import { MindMapCanvas } from "./components/MindMap";
import { useUiStore, usePdfStore, useAnnotationStore, useLibraryStore, useSettingsStore, useStudyGroupStore, useMindMapStore, useTabStore } from "./stores";
import { usePdfDocument, useAnnotationPersistence, useBookmarkPersistence, useAutoSave, usePenTablet, useSessionRestore } from "./hooks";
import { useDrag } from "./contexts";
import { GripVertical, Network } from "lucide-react";

function App() {
  const { theme, currentView, setCurrentView, activeMindMapId, setActiveMindMapId, mindMapPanelVisible, toggleMindMapPanel, mindMapPanelWidth, setMindMapPanelWidth, splitViewMode, setSplitViewMode } = useUiStore();
  const { startDrag } = useDrag();
  const { pdfDocument } = usePdfDocument();
  const { filePath, setFilePath, currentPage, setCurrentPage, setZoomLevel, setViewMode } = usePdfStore();
  const { addDocument, updateDocumentProgress } = useLibraryStore();
  const { tabs, activeTabId, openTab, updateTab, getActiveTab } = useTabStore();

  // Auto-save and load annotations and bookmarks
  useAnnotationPersistence();
  useBookmarkPersistence();
  useAutoSave({ interval: 30000 }); // Periodic backup every 30 seconds
  usePenTablet(); // Auto-switch to pen tool when stylus detected
  useSessionRestore(); // Restore previous session on startup
  const {
    zoomIn,
    zoomOut,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
  } = usePdfStore();
  const { undo, redo, setCurrentTool, selectedAnnotationIds, clearSelection, deleteSelectedAnnotations } = useAnnotationStore();
  const { findShortcutByEvent } = useSettingsStore();

  // Apply theme on mount and when it changes
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Listen for system theme changes when using "system" theme
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  // Handle URL parameter to open file in new window
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openFile = params.get("openFile");
    if (openFile) {
      const decodedPath = decodeURIComponent(openFile);
      // Clear the URL parameter to prevent re-opening on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
      // Open the file
      setFilePath(decodedPath);
      setCurrentView("viewer");
      // Open as a tab
      openTab(decodedPath, null, null, null);
    }
  }, [setFilePath, setCurrentView, openTab]);

  // Add document to library when PDF is loaded
  useEffect(() => {
    if (pdfDocument && filePath) {
      const fileName = filePath.split(/[\\/]/).pop() || "Unknown";
      pdfDocument.getMetadata().then((metadata) => {
        const info = metadata.info as Record<string, unknown>;
        addDocument(
          filePath,
          fileName,
          (info?.Title as string) || undefined,
          (info?.Author as string) || undefined,
          pdfDocument.numPages
        );
      }).catch(() => {
        addDocument(filePath, fileName, undefined, undefined, pdfDocument.numPages);
      });
    }
  }, [pdfDocument, filePath, addDocument]);

  // Save reading progress periodically
  useEffect(() => {
    if (!filePath || !pdfDocument) return;

    const saveProgress = () => {
      // Find document by file path and update progress
      const docs = useLibraryStore.getState().documents;
      const doc = docs.find((d) => d.file_path === filePath);
      if (doc) {
        updateDocumentProgress(doc.id, currentPage);
      }
    };

    // Save on page change (debounced)
    const timeout = setTimeout(saveProgress, 1000);
    return () => clearTimeout(timeout);
  }, [filePath, currentPage, pdfDocument, updateDocumentProgress]);

  const { getGroupForDocument } = useStudyGroupStore();
  const documents = useLibraryStore((state) => state.documents);

  // Handle opening document from library (with tabs support)
  const handleOpenDocument = useCallback((documentPath: string) => {
    // Find the document in library to get its ID
    const doc = documents.find((d) => d.file_path === documentPath);
    const documentId = doc?.id || null;

    // Find the study group this document belongs to
    const studyGroup = documentId ? getGroupForDocument(documentId) : undefined;
    const groupId = studyGroup?.id || null;

    // Open in a new tab (or switch to existing tab)
    // Auto-assign to study group if document belongs to one
    openTab(documentPath, null, documentId, groupId);
    setFilePath(documentPath);
    setCurrentView("viewer");
  }, [openTab, setFilePath, setCurrentView, documents, getGroupForDocument]);

  // Handle opening document from mind map node (with optional page number)
  const handleOpenDocumentAtPage = useCallback((documentPath: string, pageNumber?: number) => {
    // Find the document in library to get its ID
    const doc = documents.find((d) => d.file_path === documentPath);
    const documentId = doc?.id || null;

    // Find the study group this document belongs to
    const studyGroup = documentId ? getGroupForDocument(documentId) : undefined;
    const groupId = studyGroup?.id || null;

    // Open in a new tab (or switch to existing tab)
    openTab(documentPath, null, documentId, groupId);
    setFilePath(documentPath);
    if (pageNumber) {
      setCurrentPage(pageNumber);
    }
    setCurrentView("viewer");
  }, [openTab, setFilePath, setCurrentView, setCurrentPage, documents, getGroupForDocument]);

  // Sync pdfStore with active tab state
  useEffect(() => {
    const activeTab = getActiveTab();
    if (activeTab && activeTab.filePath !== filePath) {
      setFilePath(activeTab.filePath);
      setCurrentPage(activeTab.currentPage);
      setZoomLevel(activeTab.zoomLevel);
      setViewMode(activeTab.viewMode);
    }
  }, [activeTabId, getActiveTab, filePath, setFilePath, setCurrentPage, setZoomLevel, setViewMode]);

  // Save current state back to active tab when it changes
  useEffect(() => {
    if (activeTabId && filePath) {
      const { zoomLevel, viewMode, rotation } = usePdfStore.getState();
      updateTab(activeTabId, {
        currentPage,
        zoomLevel,
        viewMode,
        rotation,
      });
    }
  }, [activeTabId, filePath, currentPage, updateTab]);

  // Handle tab change
  const handleTabChange = useCallback((tab: { filePath: string; currentPage: number; zoomLevel: number; viewMode: "single" | "continuous" }) => {
    setFilePath(tab.filePath);
    setCurrentPage(tab.currentPage);
    setZoomLevel(tab.zoomLevel);
    setViewMode(tab.viewMode);
  }, [setFilePath, setCurrentPage, setZoomLevel, setViewMode]);

  // Get active study group's first mind map for split panel view
  // Use the currently active tab's study group
  const { getMindMapsForGroup, getMindMap, createMindMap } = useMindMapStore();
  const activeTab = getActiveTab();
  const activeTabGroupId = activeTab?.groupId || null;

  // Get or create mind map for the active tab's study group
  const getOrCreateMindMapForGroup = useCallback((groupId: string) => {
    const mindMaps = getMindMapsForGroup(groupId);
    if (mindMaps.length > 0) {
      return mindMaps[0].id;
    }
    // Create a new mind map for this group
    const group = useStudyGroupStore.getState().studyGroups.find(g => g.id === groupId);
    const newId = createMindMap(groupId, `${group?.name || "Study"} Mind Map`);
    return newId;
  }, [getMindMapsForGroup, createMindMap]);

  // Mind map ID for split panel - based on active tab's group
  // Auto-create mind map when panel is open and group exists but no mind map
  const splitPanelMindMapId = (() => {
    if (!activeTabGroupId) return null;
    const existingMindMaps = getMindMapsForGroup(activeTabGroupId);
    if (existingMindMaps.length > 0) {
      return existingMindMaps[0].id;
    }
    // If panel is visible and group exists but no mind map, create one
    if (mindMapPanelVisible) {
      return getOrCreateMindMapForGroup(activeTabGroupId);
    }
    return null;
  })();

  // Handle toggle mind map panel - create if needed
  const handleToggleMindMapPanel = useCallback(() => {
    if (!mindMapPanelVisible && activeTabGroupId) {
      // Opening panel - ensure mind map exists
      getOrCreateMindMapForGroup(activeTabGroupId);
    }
    toggleMindMapPanel();
  }, [mindMapPanelVisible, activeTabGroupId, getOrCreateMindMapForGroup, toggleMindMapPanel]);

  // Keyboard shortcuts (customizable via settings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Universal shortcuts (work in viewer)
      if (currentView === "viewer") {
        // Delete/Backspace to delete selected annotations
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          deleteSelectedAnnotations();
          return;
        }

        // Escape to clear selection
        if (e.key === "Escape") {
          e.preventDefault();
          clearSelection();
          return;
        }
      }

      // Find matching shortcut from settings
      const shortcutId = findShortcutByEvent(e);

      // File shortcuts (work in any view)
      if (shortcutId === "file.open") {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('[title*="Open"]')?.click();
        return;
      }

      if (shortcutId === "file.backToLibrary" && currentView === "viewer") {
        e.preventDefault();
        setCurrentView("library");
        return;
      }

      if (shortcutId === "file.save" && currentView === "viewer") {
        e.preventDefault();
        // Trigger save button click
        document.querySelector<HTMLButtonElement>('[title*="Save PDF"]')?.click();
        return;
      }

      // Only process PDF shortcuts when in viewer
      if (currentView !== "viewer") return;

      if (shortcutId) {
        e.preventDefault();

        // Tool shortcuts
        if (shortcutId.startsWith("tool.")) {
          const tool = shortcutId.replace("tool.", "");
          const toolMap: Record<string, Parameters<typeof setCurrentTool>[0]> = {
            select: "select",
            pen: "pen",
            highlighter: "highlighter",
            eraser: "eraser",
            note: "note",
            underline: "underline",
            strikeout: "strikeout",
            rect: "rect",
            arrow: "arrow",
            text: "text",
          };
          if (toolMap[tool]) {
            setCurrentTool(toolMap[tool]);
          }
          return;
        }

        // Edit shortcuts
        switch (shortcutId) {
          case "edit.undo":
            undo();
            break;
          case "edit.redo":
          case "edit.redoAlt":
            redo();
            break;
        }

        // View shortcuts
        switch (shortcutId) {
          case "view.zoomIn":
            zoomIn();
            break;
          case "view.zoomOut":
            zoomOut();
            break;
        }

        // Navigation shortcuts
        switch (shortcutId) {
          case "nav.nextPage":
            goToNextPage();
            break;
          case "nav.prevPage":
            goToPreviousPage();
            break;
          case "nav.firstPage":
            goToFirstPage();
            break;
          case "nav.lastPage":
            goToLastPage();
            break;
        }

        // Feature shortcuts
        switch (shortcutId) {
          case "feature.toggleMindMap":
            handleToggleMindMapPanel();
            break;
          case "feature.pdfOnlyView":
            setSplitViewMode("pdfOnly");
            break;
          case "feature.mindMapOnlyView":
            setSplitViewMode("mindMapOnly");
            break;
          case "feature.splitView":
            setSplitViewMode("split");
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentView,
    setCurrentView,
    findShortcutByEvent,
    undo,
    redo,
    zoomIn,
    zoomOut,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    setCurrentTool,
    handleToggleMindMapPanel,
    setSplitViewMode,
    clearSelection,
    deleteSelectedAnnotations,
  ]);

  // Handle opening mind map
  const handleOpenMindMap = useCallback((mindMapId: string) => {
    setActiveMindMapId(mindMapId);
    setCurrentView("mindmap");
  }, [setActiveMindMapId, setCurrentView]);

  // Handle closing mind map
  const handleCloseMindMap = useCallback(() => {
    setActiveMindMapId(null);
    setCurrentView("library");
  }, [setActiveMindMapId, setCurrentView]);

  // Resize handle state for mind map panel
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = mindMapPanelWidth;
  }, [mindMapPanelWidth]);

  // Handle resize move/end
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartX.current - e.clientX;
      const newWidth = resizeStartWidth.current + delta;
      setMindMapPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Add cursor style to body during resize
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setMindMapPanelWidth]);

  // Get studyGroupId for standalone mindmap view
  const activeMindMapStudyGroupId = activeMindMapId
    ? getMindMap(activeMindMapId)?.studyGroupId || ""
    : "";

  // Check if we should show the drag handle
  const hasSelectedAnnotations = selectedAnnotationIds.size > 0;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Toolbar />
      {/* Tab bar - only show in viewer mode with open tabs */}
      {currentView === "viewer" && tabs.length > 0 && (
        <TabBar onTabChange={handleTabChange} />
      )}
      <div className="flex flex-1 overflow-hidden">
        {currentView === "library" ? (
          <Library onOpenDocument={handleOpenDocument} onOpenMindMap={handleOpenMindMap} />
        ) : currentView === "mindmap" && activeMindMapId ? (
          <MindMapCanvas mindMapId={activeMindMapId} studyGroupId={activeMindMapStudyGroupId} onClose={handleCloseMindMap} onOpenDocument={handleOpenDocumentAtPage} />
        ) : (
          <>
            {/* Show PDF view unless in mindMapOnly mode */}
            {(!mindMapPanelVisible || splitViewMode !== "mindMapOnly") && (
              <>
                <Sidebar pdfDocument={pdfDocument} />
                <main className="flex-1 flex overflow-hidden relative">
                  <PdfViewer pdfDocument={pdfDocument} />
                  {/* Drag handle for selected annotations */}
                  {hasSelectedAnnotations && mindMapPanelVisible && splitViewMode === "split" && (
                    <div
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        const activeTab = getActiveTab();
                        startDrag({
                          type: "annotation",
                          annotationIds: Array.from(selectedAnnotationIds),
                          documentId: activeTab?.documentId || null,
                          filePath: filePath,
                        }, e.clientX, e.clientY);
                      }}
                      className="absolute bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg shadow-lg cursor-grab active:cursor-grabbing hover:bg-purple-700 transition-colors select-none"
                    >
                      <GripVertical className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {selectedAnnotationIds.size} 선택됨
                      </span>
                      <Network className="w-4 h-4" />
                      <span className="text-xs">→ 마인드맵으로 드래그</span>
                    </div>
                  )}
                </main>
              </>
            )}
            {/* Mind Map Split Panel - show unless in pdfOnly mode */}
            {mindMapPanelVisible && splitViewMode !== "pdfOnly" && (
              <>
                {/* Resize Handle - only in split view */}
                {splitViewMode === "split" && (
                  <div
                    className={`w-1.5 flex-shrink-0 cursor-col-resize group relative ${
                      isResizing ? "bg-blue-500" : "hover:bg-blue-400"
                    }`}
                    onMouseDown={handleResizeStart}
                  >
                    <div className="absolute inset-y-0 -left-1 -right-1" />
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-colors ${
                      isResizing ? "bg-blue-300" : "bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-300"
                    }`} />
                  </div>
                )}
                {/* Mind Map Panel */}
                <div
                  className={`border-l border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col ${
                    splitViewMode === "mindMapOnly" ? "flex-1" : ""
                  }`}
                  style={splitViewMode === "mindMapOnly" ? undefined : { width: mindMapPanelWidth }}
                >
                {splitPanelMindMapId && activeTabGroupId ? (
                  <MindMapCanvas
                    mindMapId={splitPanelMindMapId}
                    studyGroupId={activeTabGroupId}
                    onClose={handleToggleMindMapPanel}
                    onOpenDocument={handleOpenDocumentAtPage}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <p className="text-lg font-medium mb-2">마인드맵 없음</p>
                      <p className="text-sm mb-4">
                        현재 PDF가 스터디 그룹에 속해있지 않습니다.
                      </p>
                      <p className="text-xs">
                        탭을 우클릭하여 그룹에 추가하세요.
                      </p>
                    </div>
                    <button
                      onClick={handleToggleMindMapPanel}
                      className="mt-4 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      닫기
                    </button>
                  </div>
                )}
              </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
