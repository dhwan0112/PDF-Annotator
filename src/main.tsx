import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DragProvider } from "./contexts";
import "./index.css";

// Note: HTML5 drag-and-drop handlers removed - using custom mouse-based drag system instead

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DragProvider>
      <App />
    </DragProvider>
  </React.StrictMode>,
);
