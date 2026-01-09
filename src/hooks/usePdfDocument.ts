import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { usePdfStore } from "../stores";

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

export function usePdfDocument() {
  const { filePath, setTotalPages } = usePdfStore();
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[usePdfDocument] useEffect triggered, filePath:", filePath);

    if (!filePath) {
      console.log("[usePdfDocument] No filePath, clearing document");
      setPdfDocument(null);
      setError(null);
      return;
    }

    let cancelled = false;
    let currentDoc: pdfjsLib.PDFDocumentProxy | null = null;

    const loadPdf = async () => {
      console.log("[usePdfDocument] Starting PDF load:", filePath);
      setLoading(true);
      setError(null);

      try {
        // Use Tauri fs plugin to read file
        const { readFile } = await import("@tauri-apps/plugin-fs");
        console.log("[usePdfDocument] Reading file...");
        const fileData = await readFile(filePath);
        const data = fileData.buffer;

        if (cancelled) {
          console.log("[usePdfDocument] Cancelled after file read");
          return;
        }

        console.log("[usePdfDocument] Parsing PDF...");
        const pdf = await pdfjsLib.getDocument({ data }).promise;

        if (cancelled) {
          console.log("[usePdfDocument] Cancelled after PDF parse");
          pdf.destroy();
          return;
        }

        console.log("[usePdfDocument] PDF loaded successfully, pages:", pdf.numPages);
        currentDoc = pdf;
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
      } catch (err) {
        if (cancelled) return;
        console.error("[usePdfDocument] Failed to load PDF:", err);
        setError(err instanceof Error ? err.message : "Failed to load PDF");
      } finally {
        if (!cancelled) {
          console.log("[usePdfDocument] Load complete, setting loading=false");
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      console.log("[usePdfDocument] Cleanup - destroying document for:", filePath);
      cancelled = true;
      currentDoc?.destroy();
    };
  }, [filePath, setTotalPages]);

  return { pdfDocument, loading, error };
}
