import { useEffect, useCallback } from "react";
import { Toolbar } from "./components/Toolbar";
import { Sidebar } from "./components/Sidebar";
import { PdfViewer } from "./components/PdfViewer";
import { Library } from "./components/Library";
import { useUiStore, usePdfStore, useAnnotationStore, useLibraryStore } from "./stores";
import { usePdfDocument, useAnnotationPersistence, useBookmarkPersistence } from "./hooks";

function App() {
  const { theme, currentView, setCurrentView } = useUiStore();
  const { pdfDocument } = usePdfDocument();
  const { filePath, setFilePath } = usePdfStore();
  const { addDocument, updateDocumentProgress } = useLibraryStore();

  // Auto-save and load annotations and bookmarks
  useAnnotationPersistence();
  useBookmarkPersistence();
  const {
    zoomIn,
    zoomOut,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    currentPage,
  } = usePdfStore();
  const { undo, redo, setCurrentTool } = useAnnotationStore();

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

  // Handle opening document from library
  const handleOpenDocument = useCallback((documentPath: string) => {
    setFilePath(documentPath);
    setCurrentView("viewer");
  }, [setFilePath, setCurrentView]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Escape to go back to library
      if (e.key === "Escape" && currentView === "viewer") {
        setCurrentView("library");
        return;
      }

      // Only process PDF shortcuts when in viewer
      if (currentView !== "viewer") return;

      // Ctrl shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "o":
            e.preventDefault();
            document.querySelector<HTMLButtonElement>('[title*="Open"]')?.click();
            break;
          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
          case "y":
            e.preventDefault();
            redo();
            break;
          case "=":
          case "+":
            e.preventDefault();
            zoomIn();
            break;
          case "-":
            e.preventDefault();
            zoomOut();
            break;
        }
        return;
      }

      // Non-modifier shortcuts
      switch (e.key) {
        case "PageDown":
          e.preventDefault();
          goToNextPage();
          break;
        case "PageUp":
          e.preventDefault();
          goToPreviousPage();
          break;
        case "Home":
          e.preventDefault();
          goToFirstPage();
          break;
        case "End":
          e.preventDefault();
          goToLastPage();
          break;
        case "v":
        case "V":
          setCurrentTool("select");
          break;
        case "p":
        case "P":
          setCurrentTool("pen");
          break;
        case "h":
        case "H":
          setCurrentTool("highlighter");
          break;
        case "e":
        case "E":
          setCurrentTool("eraser");
          break;
        case "n":
        case "N":
          setCurrentTool("note");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentView,
    setCurrentView,
    undo,
    redo,
    zoomIn,
    zoomOut,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    setCurrentTool,
  ]);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {currentView === "library" ? (
          <Library onOpenDocument={handleOpenDocument} />
        ) : (
          <>
            <Sidebar pdfDocument={pdfDocument} />
            <main className="flex-1 flex flex-col overflow-hidden">
              <PdfViewer pdfDocument={pdfDocument} />
            </main>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
