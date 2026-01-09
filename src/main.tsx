import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createPortal } from "react-dom";
import App from "./App";
import { DragProvider } from "./contexts";
import { usePdfStore, useTabStore } from "./stores";
import "./index.css";

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
    <DragProvider>
      <App />
      <DebugStatusBar />
    </DragProvider>
  </React.StrictMode>,
);
