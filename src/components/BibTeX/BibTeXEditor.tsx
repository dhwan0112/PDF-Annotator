import { useState, useEffect, useCallback } from "react";
import {
  X,
  Save,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  BookOpen,
  FileText,
  User,
  Calendar,
  Link2,
  Hash,
} from "lucide-react";
import type { BibTeXMetadata, BibTeXEntryType } from "../../types";
import { useBibtexStore, formatBibTeXEntry, generateCiteKey } from "../../stores";
import { extractBibTeXFromPdf, fetchFromCrossRef } from "../../services/bibtexService";

interface BibTeXEditorProps {
  documentId: string;
  filePath: string;
  documentTitle?: string;
  documentAuthor?: string;
  onClose: () => void;
}

const ENTRY_TYPES: { value: BibTeXEntryType; label: string }[] = [
  { value: "article", label: "Journal Article" },
  { value: "inproceedings", label: "Conference Paper" },
  { value: "book", label: "Book" },
  { value: "incollection", label: "Book Chapter" },
  { value: "phdthesis", label: "PhD Thesis" },
  { value: "mastersthesis", label: "Master's Thesis" },
  { value: "techreport", label: "Technical Report" },
  { value: "misc", label: "Miscellaneous" },
];

export function BibTeXEditor({
  documentId,
  filePath,
  documentTitle,
  documentAuthor,
  onClose,
}: BibTeXEditorProps) {
  const { getEntry, setEntry } = useBibtexStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "raw">("form");

  // Form state
  const [metadata, setMetadata] = useState<BibTeXMetadata>({
    entryType: "misc",
    citeKey: "",
    title: documentTitle || "",
    authors: documentAuthor ? [documentAuthor] : [],
  });

  // Load existing entry or create default
  useEffect(() => {
    const existing = getEntry(documentId);
    if (existing) {
      setMetadata(existing);
    } else {
      // Create default from document info
      const defaultMeta: BibTeXMetadata = {
        entryType: "misc",
        citeKey: "",
        title: documentTitle || "Untitled",
        authors: documentAuthor ? [documentAuthor] : [],
        extractedAt: new Date(),
        extractionMethod: "manual",
      };
      defaultMeta.citeKey = generateCiteKey(defaultMeta);
      setMetadata(defaultMeta);
    }
  }, [documentId, getEntry, documentTitle, documentAuthor]);

  // Handle auto-extract
  const handleAutoExtract = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const extracted = await extractBibTeXFromPdf(
        filePath,
        documentTitle ?? undefined,
        documentAuthor ?? undefined
      );
      setMetadata(extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract metadata");
    } finally {
      setIsLoading(false);
    }
  }, [filePath, documentTitle, documentAuthor]);

  // Handle DOI lookup
  const handleDoiLookup = useCallback(async () => {
    if (!metadata.doi) {
      setError("Please enter a DOI first");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFromCrossRef(metadata.doi);
      if (result) {
        setMetadata(result);
      } else {
        setError("Could not find metadata for this DOI");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lookup DOI");
    } finally {
      setIsLoading(false);
    }
  }, [metadata.doi]);

  // Handle save
  const handleSave = useCallback(() => {
    // Ensure citeKey is generated
    const toSave = { ...metadata };
    if (!toSave.citeKey) {
      toSave.citeKey = generateCiteKey(toSave);
    }
    setEntry(documentId, toSave);
    onClose();
  }, [documentId, metadata, setEntry, onClose]);

  // Handle copy BibTeX
  const handleCopyBibtex = useCallback(() => {
    const bibtex = formatBibTeXEntry(metadata);
    navigator.clipboard.writeText(bibtex);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [metadata]);

  // Update field helper
  const updateField = (field: keyof BibTeXMetadata, value: unknown) => {
    setMetadata((prev) => {
      const updated = { ...prev, [field]: value };
      // Regenerate cite key if relevant fields changed
      if (field === "authors" || field === "year" || field === "title") {
        updated.citeKey = generateCiteKey(updated);
      }
      return updated;
    });
  };

  // Parse authors string to array
  const authorsString = metadata.authors?.join("; ") || "";
  const handleAuthorsChange = (value: string) => {
    const authors = value.split(/;\s*/).filter((a) => a.trim());
    updateField("authors", authors);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            BibTeX Metadata
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoExtract}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Auto Extract
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("form")}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "form"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Form
          </button>
          <button
            onClick={() => setActiveTab("raw")}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "raw"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Raw BibTeX
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {activeTab === "form" ? (
            <div className="space-y-4">
              {/* Entry Type & Cite Key */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Entry Type
                  </label>
                  <select
                    value={metadata.entryType}
                    onChange={(e) => updateField("entryType", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {ENTRY_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Hash className="w-3 h-3 inline mr-1" />
                    Cite Key
                  </label>
                  <input
                    type="text"
                    value={metadata.citeKey}
                    onChange={(e) => updateField("citeKey", e.target.value)}
                    placeholder="author2024keyword"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <FileText className="w-3 h-3 inline mr-1" />
                  Title
                </label>
                <input
                  type="text"
                  value={metadata.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Authors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <User className="w-3 h-3 inline mr-1" />
                  Authors (separated by semicolon)
                </label>
                <input
                  type="text"
                  value={authorsString}
                  onChange={(e) => handleAuthorsChange(e.target.value)}
                  placeholder="Last, First; Last, First"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Year */}
              <div className="w-32">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  Year
                </label>
                <input
                  type="number"
                  value={metadata.year || ""}
                  onChange={(e) => updateField("year", e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="2024"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* DOI with lookup */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Link2 className="w-3 h-3 inline mr-1" />
                  DOI
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={metadata.doi || ""}
                    onChange={(e) => updateField("doi", e.target.value || undefined)}
                    placeholder="10.1234/example.2024"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={handleDoiLookup}
                    disabled={isLoading || !metadata.doi}
                    className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                    Lookup
                  </button>
                </div>
              </div>

              {/* Type-specific fields */}
              {(metadata.entryType === "article") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Journal
                    </label>
                    <input
                      type="text"
                      value={metadata.journal || ""}
                      onChange={(e) => updateField("journal", e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Volume
                      </label>
                      <input
                        type="text"
                        value={metadata.volume || ""}
                        onChange={(e) => updateField("volume", e.target.value || undefined)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Issue
                      </label>
                      <input
                        type="text"
                        value={metadata.number || ""}
                        onChange={(e) => updateField("number", e.target.value || undefined)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Pages
                      </label>
                      <input
                        type="text"
                        value={metadata.pages || ""}
                        onChange={(e) => updateField("pages", e.target.value || undefined)}
                        placeholder="1--10"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                </div>
              )}

              {(metadata.entryType === "inproceedings") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Conference/Booktitle
                  </label>
                  <input
                    type="text"
                    value={metadata.booktitle || ""}
                    onChange={(e) => updateField("booktitle", e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}

              {(metadata.entryType === "book" || metadata.entryType === "incollection") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Publisher
                  </label>
                  <input
                    type="text"
                    value={metadata.publisher || ""}
                    onChange={(e) => updateField("publisher", e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}

              {(metadata.entryType === "phdthesis" || metadata.entryType === "mastersthesis") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    School/University
                  </label>
                  <input
                    type="text"
                    value={metadata.school || ""}
                    onChange={(e) => updateField("school", e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}

              {/* Abstract */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Abstract
                </label>
                <textarea
                  value={metadata.abstract || ""}
                  onChange={(e) => updateField("abstract", e.target.value || undefined)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                />
              </div>

              {/* Extraction info */}
              {metadata.extractedAt && (
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <span>
                    Extracted: {new Date(metadata.extractedAt).toLocaleDateString()}
                  </span>
                  {metadata.extractionMethod && (
                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                      {metadata.extractionMethod}
                    </span>
                  )}
                  {metadata.confidence !== undefined && (
                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                      {Math.round(metadata.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Raw BibTeX view
            <div className="relative">
              <pre className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap overflow-x-auto">
                {formatBibTeXEntry(metadata)}
              </pre>
              <button
                onClick={handleCopyBibtex}
                className="absolute top-2 right-2 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm flex items-center gap-1 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
