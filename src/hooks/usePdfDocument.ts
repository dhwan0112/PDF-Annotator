import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { usePdfStore } from "../stores";

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
    if (!filePath) {
      setPdfDocument(null);
      setError(null);
      return;
    }

    let cancelled = false;
    let currentDoc: pdfjsLib.PDFDocumentProxy | null = null;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      setPdfDocument(null);

      try {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const fileData = await readFile(filePath);
        const data = fileData.buffer;

        if (cancelled) return;

        const pdf = await pdfjsLib.getDocument({ data }).promise;

        if (cancelled) {
          pdf.destroy();
          return;
        }

        currentDoc = pdf;
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
      } catch (err) {
        if (cancelled) return;
        console.error("[usePdfDocument] Failed to load PDF:", err);
        setError(err instanceof Error ? err.message : "Failed to load PDF");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      currentDoc?.destroy();
    };
  }, [filePath, setTotalPages]);

  return { pdfDocument, loading, error };
}
