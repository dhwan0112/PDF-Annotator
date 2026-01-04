import { useEffect } from "react";
import { Toolbar } from "./components/Toolbar";
import { Sidebar } from "./components/Sidebar";
import { PdfViewer } from "./components/PdfViewer";
import { useUiStore, usePdfStore, useAnnotationStore } from "./stores";
import { usePdfDocument, useAnnotationPersistence, useBookmarkPersistence } from "./hooks";

function App() {
  const { theme } = useUiStore();
  const { pdfDocument } = usePdfDocument();

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
        <Sidebar pdfDocument={pdfDocument} />
        <main className="flex-1 flex flex-col overflow-hidden">
          <PdfViewer pdfDocument={pdfDocument} />
        </main>
      </div>
    </div>
  );
}

export default App;
