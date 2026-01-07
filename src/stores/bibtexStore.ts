import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BibTeXMetadata } from "../types";

interface BibtexState {
  // BibTeX data keyed by document ID
  entries: Map<string, BibTeXMetadata>;

  // Actions
  setEntry: (documentId: string, metadata: BibTeXMetadata) => void;
  getEntry: (documentId: string) => BibTeXMetadata | undefined;
  updateEntry: (documentId: string, updates: Partial<BibTeXMetadata>) => void;
  deleteEntry: (documentId: string) => void;
  hasEntry: (documentId: string) => boolean;

  // Bulk operations
  getEntriesForDocuments: (documentIds: string[]) => Map<string, BibTeXMetadata>;
  exportAsBibTeX: (documentIds: string[]) => string;
}

// Helper to generate a cite key from metadata
export function generateCiteKey(metadata: Partial<BibTeXMetadata>): string {
  const firstAuthor = metadata.authors?.[0];
  let authorPart = "Unknown";

  if (firstAuthor) {
    // Extract last name: "Kim, Minjun" -> "Kim", "Minjun Kim" -> "Kim"
    const parts = firstAuthor.split(/,\s*/);
    if (parts.length > 1) {
      authorPart = parts[0]; // "Kim, Minjun" -> "Kim"
    } else {
      const nameParts = firstAuthor.split(/\s+/);
      authorPart = nameParts[nameParts.length - 1]; // "Minjun Kim" -> "Kim"
    }
  }

  const year = metadata.year || new Date().getFullYear();

  // Extract first significant word from title
  let titleWord = "";
  if (metadata.title) {
    const stopWords = new Set(["a", "an", "the", "of", "on", "in", "for", "to", "and"]);
    const words = metadata.title.toLowerCase().split(/\s+/);
    for (const word of words) {
      const cleaned = word.replace(/[^a-z]/g, "");
      if (cleaned.length > 2 && !stopWords.has(cleaned)) {
        titleWord = cleaned;
        break;
      }
    }
  }

  // Clean and combine
  const cleanAuthor = authorPart.replace(/[^a-zA-Z]/g, "");
  return `${cleanAuthor}${year}${titleWord}`.toLowerCase();
}

// Helper to format a single BibTeX entry
export function formatBibTeXEntry(metadata: BibTeXMetadata): string {
  const fields: string[] = [];

  // Authors - format as "Last1, First1 and Last2, First2"
  if (metadata.authors && metadata.authors.length > 0) {
    fields.push(`  author = {${metadata.authors.join(" and ")}}`);
  }

  // Title
  fields.push(`  title = {${metadata.title}}`);

  // Year
  if (metadata.year) {
    fields.push(`  year = {${metadata.year}}`);
  }

  // Journal (for articles)
  if (metadata.journal) {
    fields.push(`  journal = {${metadata.journal}}`);
  }

  // Booktitle (for inproceedings)
  if (metadata.booktitle) {
    fields.push(`  booktitle = {${metadata.booktitle}}`);
  }

  // Volume
  if (metadata.volume) {
    fields.push(`  volume = {${metadata.volume}}`);
  }

  // Number/Issue
  if (metadata.number) {
    fields.push(`  number = {${metadata.number}}`);
  }

  // Pages
  if (metadata.pages) {
    fields.push(`  pages = {${metadata.pages}}`);
  }

  // Publisher
  if (metadata.publisher) {
    fields.push(`  publisher = {${metadata.publisher}}`);
  }

  // School (for theses)
  if (metadata.school) {
    fields.push(`  school = {${metadata.school}}`);
  }

  // Institution (for tech reports)
  if (metadata.institution) {
    fields.push(`  institution = {${metadata.institution}}`);
  }

  // DOI
  if (metadata.doi) {
    fields.push(`  doi = {${metadata.doi}}`);
  }

  // URL
  if (metadata.url) {
    fields.push(`  url = {${metadata.url}}`);
  }

  // ISBN
  if (metadata.isbn) {
    fields.push(`  isbn = {${metadata.isbn}}`);
  }

  // ISSN
  if (metadata.issn) {
    fields.push(`  issn = {${metadata.issn}}`);
  }

  // Abstract
  if (metadata.abstract) {
    fields.push(`  abstract = {${metadata.abstract}}`);
  }

  // Keywords
  if (metadata.keywords && metadata.keywords.length > 0) {
    fields.push(`  keywords = {${metadata.keywords.join(", ")}}`);
  }

  // Note
  if (metadata.note) {
    fields.push(`  note = {${metadata.note}}`);
  }

  return `@${metadata.entryType}{${metadata.citeKey},\n${fields.join(",\n")}\n}`;
}

// Create default entry for a document
export function createDefaultEntry(
  title: string,
  author?: string | null
): BibTeXMetadata {
  const authors = author ? [author] : [];
  const metadata: BibTeXMetadata = {
    entryType: "misc",
    citeKey: "",
    title: title || "Untitled",
    authors,
    extractionMethod: "manual",
    extractedAt: new Date(),
  };
  metadata.citeKey = generateCiteKey(metadata);
  return metadata;
}

export const useBibtexStore = create<BibtexState>()(
  persist(
    (set, get) => ({
      entries: new Map(),

      setEntry: (documentId: string, metadata: BibTeXMetadata) => {
        set((state) => {
          const newEntries = new Map(state.entries);
          newEntries.set(documentId, metadata);
          return { entries: newEntries };
        });
      },

      getEntry: (documentId: string) => {
        return get().entries.get(documentId);
      },

      updateEntry: (documentId: string, updates: Partial<BibTeXMetadata>) => {
        set((state) => {
          const existing = state.entries.get(documentId);
          if (!existing) return state;

          const updated = { ...existing, ...updates };
          // Regenerate cite key if title or authors changed
          if (updates.title || updates.authors || updates.year) {
            updated.citeKey = generateCiteKey(updated);
          }

          const newEntries = new Map(state.entries);
          newEntries.set(documentId, updated);
          return { entries: newEntries };
        });
      },

      deleteEntry: (documentId: string) => {
        set((state) => {
          const newEntries = new Map(state.entries);
          newEntries.delete(documentId);
          return { entries: newEntries };
        });
      },

      hasEntry: (documentId: string) => {
        return get().entries.has(documentId);
      },

      getEntriesForDocuments: (documentIds: string[]) => {
        const result = new Map<string, BibTeXMetadata>();
        const entries = get().entries;
        for (const id of documentIds) {
          const entry = entries.get(id);
          if (entry) {
            result.set(id, entry);
          }
        }
        return result;
      },

      exportAsBibTeX: (documentIds: string[]) => {
        const entries = get().entries;
        const bibEntries: string[] = [];

        for (const id of documentIds) {
          const entry = entries.get(id);
          if (entry) {
            bibEntries.push(formatBibTeXEntry(entry));
          }
        }

        return bibEntries.join("\n\n");
      },
    }),
    {
      name: "marginalia-bibtex",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          // Convert entries array back to Map
          if (parsed.state?.entries) {
            parsed.state.entries = new Map(parsed.state.entries);
          }
          return parsed;
        },
        setItem: (name, value) => {
          // Convert Map to array for JSON serialization
          const toStore = {
            ...value,
            state: {
              ...value.state,
              entries: Array.from(value.state.entries.entries()),
            },
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
