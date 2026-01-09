import React, { useEffect, useState, Component, ErrorInfo, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { createPortal } from "react-dom";
import App from "./App";
import { DragProvider } from "./contexts";
import { usePdfStore, useTabStore } from "./stores";
import "./index.css";

// Error Boundary to catch render errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "#1a0000",
          color: "#ff6666",
          fontFamily: "monospace",
          padding: "20px",
          zIndex: 999999,
          overflow: "auto",
        }}>
          <h1 style={{ color: "#ff0000" }}>🚨 React Render Error</h1>
          <p>Something went wrong while rendering the application:</p>
          <pre style={{ background: "#330000", padding: "10px", overflow: "auto", whiteSpace: "pre-wrap" }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: "20px", padding: "10px 20px", cursor: "pointer" }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Always-visible debug status bar
function DebugStatusBar() {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const { filePath, currentPage } = usePdfStore();
  const { activeTabId, tabs } = useTabStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        setVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Intercept console.log and console.error
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      originalLog(...args);
      const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      if (msg.startsWith("[")) {
        setLogs((prev) => [...prev.slice(-15), msg]);
      }
    };

    console.error = (...args) => {
      originalError(...args);
      const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      setErrors((prev) => [...prev.slice(-5), `[ERROR] ${msg}`]);
      // Auto-show debug panel on error
      setVisible(true);
    };

    // Also catch unhandled errors
    const errorHandler = (e: ErrorEvent) => {
      setErrors((prev) => [...prev.slice(-5), `[UNHANDLED] ${e.message}`]);
      setVisible(true);
    };
    window.addEventListener("error", errorHandler);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      window.removeEventListener("error", errorHandler);
    };
  }, []);

  if (!visible) return null;

  return createPortal(
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "rgba(0,0,0,0.95)",
      color: "#0f0",
      fontFamily: "monospace",
      fontSize: "11px",
      padding: "8px",
      zIndex: 99999,
      maxHeight: "40vh",
      overflow: "auto",
    }}>
      <div style={{ color: "#ff0", marginBottom: "4px" }}>
        🐛 DEBUG (Ctrl+Shift+D) | activeTabId: {activeTabId || "null"} | filePath: {filePath ? "..." + filePath.slice(-30) : "null"} | page: {currentPage} | tabs: {tabs.length}
      </div>
      {errors.length > 0 && (
        <div style={{ background: "#500", padding: "4px", marginBottom: "4px", borderRadius: "4px" }}>
          <div style={{ color: "#f55", fontWeight: "bold" }}>⚠️ ERRORS:</div>
          {errors.map((err, i) => <div key={i} style={{ color: "#faa" }}>{err}</div>)}
        </div>
      )}
      <div style={{ borderTop: "1px solid #333", paddingTop: "4px" }}>
        {logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>
    </div>,
    document.body
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <DragProvider>
        <App />
        <DebugStatusBar />
      </DragProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
