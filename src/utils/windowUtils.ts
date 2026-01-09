import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

let windowCounter = 0;

export async function openInNewWindow(filePath: string): Promise<boolean> {
  try {
    windowCounter++;
    const windowLabel = `pdf-window-${Date.now()}-${windowCounter}`;

    // Encode the file path for URL
    const encodedPath = encodeURIComponent(filePath);
    const url = `index.html?openFile=${encodedPath}`;

    const webview = new WebviewWindow(windowLabel, {
      url,
      title: filePath.split(/[\\/]/).pop() || "Marginalia",
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      resizable: true,
      center: true,
    });

    // Wait for window to be created
    await new Promise<void>((resolve, reject) => {
      webview.once("tauri://created", () => {
        resolve();
      });
      webview.once("tauri://error", (e) => {
        reject(e);
      });
    });

    return true;
  } catch (error) {
    console.error("Failed to open new window:", error);
    return false;
  }
}
