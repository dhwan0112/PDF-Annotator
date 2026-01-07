import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// CRITICAL: Global drag-and-drop handler to prevent forbidden cursor
// This MUST be added before React renders to ensure it captures all drag events
document.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }
}, { capture: true });

document.addEventListener("dragenter", (e) => {
  e.preventDefault();
}, { capture: true });

// Also prevent default on drop to allow custom handling
document.addEventListener("drop", (_e) => {
  // Only prevent default if not handled by a React component
  // The React components will stop propagation if they handle the drop
}, { capture: false });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
