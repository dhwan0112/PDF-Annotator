import { invoke } from "@tauri-apps/api/core";
import type { BibTeXMetadata, BibTeXEntryType } from "../types";
import { generateCiteKey } from "../stores/bibtexStore";

// CrossRef API response types
interface CrossRefAuthor {
  given?: string;
  family?: string;
  name?: string; // Some entries have just "name" instead of given/family
}

interface CrossRefWork {
  DOI?: string;
  title?: string[];
  author?: CrossRefAuthor[];
  published?: {
    "date-parts"?: number[][];
  };
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  type?: string;
  abstract?: string;
  ISBN?: string[];
  ISSN?: string[];
  URL?: string;
  subject?: string[];
}

interface CrossRefResponse {
  status: string;
  message: CrossRefWork;
}

// DOI patterns to extract from text
const DOI_PATTERNS = [
  // Standard DOI pattern: 10.xxxx/xxxxx
  /\b(10\.\d{4,}(?:\.\d+)*\/(?:(?!["&'<>])\S)+)\b/gi,
  // DOI with prefix: doi:10.xxxx/xxxxx or DOI:10.xxxx/xxxxx
  /\bDOI:\s*(10\.\d{4,}(?:\.\d+)*\/(?:(?!["&'<>])\S)+)\b/gi,
  // DOI URL: https://doi.org/10.xxxx/xxxxx
  /https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,}(?:\.\d+)*\/(?:(?!["&'<>])\S)+)\b/gi,
];

/**
 * Extract DOI from text (first page of PDF)
 */
export function extractDoiFromText(text: string): string | null {
  for (const pattern of DOI_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex state
    const match = pattern.exec(text);
    if (match) {
      // Clean up the DOI - remove trailing punctuation
      let doi = match[1] || match[0];
      doi = doi.replace(/[.,;:)\]}>]+$/, "");
      // Validate basic DOI structure
      if (doi.startsWith("10.") && doi.includes("/")) {
        return doi;
      }
    }
  }
  return null;
}

/**
 * Map CrossRef type to BibTeX entry type
 */
function mapCrossRefType(type?: string): BibTeXEntryType {
  switch (type) {
    case "journal-article":
      return "article";
    case "proceedings-article":
    case "paper-conference":
      return "inproceedings";
    case "book":
    case "monograph":
      return "book";
    case "book-chapter":
    case "book-section":
      return "incollection";
    case "dissertation":
      return "phdthesis";
    case "report":
    case "report-series":
      return "techreport";
    default:
      return "misc";
  }
}

/**
 * Format author name from CrossRef format to BibTeX format
 */
function formatAuthor(author: CrossRefAuthor): string {
  if (author.name) {
    return author.name;
  }
  if (author.family && author.given) {
    return `${author.family}, ${author.given}`;
  }
  if (author.family) {
    return author.family;
  }
  return "Unknown";
}

/**
 * Fetch bibliographic data from CrossRef API using DOI
 */
export async function fetchFromCrossRef(doi: string): Promise<BibTeXMetadata | null> {
  try {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "PDF-Annotator/1.0 (mailto:user@example.com)",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`CrossRef API returned ${response.status} for DOI: ${doi}`);
      return null;
    }

    const data: CrossRefResponse = await response.json();
    const work = data.message;

    if (!work) {
      return null;
    }

    const metadata: BibTeXMetadata = {
      entryType: mapCrossRefType(work.type),
      citeKey: "", // Will be generated
      title: work.title?.[0] || "Untitled",
      authors: work.author?.map(formatAuthor) || [],
      year: work.published?.["date-parts"]?.[0]?.[0],
      doi: work.DOI,
      extractedAt: new Date(),
      extractionMethod: "doi_lookup",
      confidence: 0.95,
    };

    // Add type-specific fields
    if (metadata.entryType === "article") {
      metadata.journal = work["container-title"]?.[0];
      metadata.volume = work.volume;
      metadata.number = work.issue;
      metadata.pages = work.page;
      metadata.issn = work.ISSN?.[0];
    } else if (metadata.entryType === "inproceedings") {
      metadata.booktitle = work["container-title"]?.[0];
      metadata.pages = work.page;
    } else if (metadata.entryType === "book" || metadata.entryType === "incollection") {
      metadata.publisher = work.publisher;
      metadata.isbn = work.ISBN?.[0];
    }

    // Common optional fields
    if (work.abstract) {
      // Clean up abstract (remove HTML tags)
      metadata.abstract = work.abstract.replace(/<[^>]*>/g, "").trim();
    }
    if (work.URL) {
      metadata.url = work.URL;
    }
    if (work.subject && work.subject.length > 0) {
      metadata.keywords = work.subject;
    }

    // Generate cite key
    metadata.citeKey = generateCiteKey(metadata);

    return metadata;
  } catch (error) {
    console.error("Failed to fetch from CrossRef:", error);
    return null;
  }
}

/**
 * Extract text from PDF first page (calls Rust backend)
 */
export async function extractPdfText(filePath: string, pageNumbers: number[] = [1]): Promise<string> {
  try {
    const text = await invoke<string>("extract_pdf_text", {
      filePath,
      pageNumbers,
    });
    return text;
  } catch (error) {
    console.warn("PDF text extraction not available:", error);
    return "";
  }
}

/**
 * Parse author names from first page text (heuristic)
 */
function parseAuthorsFromText(text: string): string[] {
  // Look for common patterns:
  // - Names after title, before abstract/introduction
  // - Names separated by commas or "and"
  // - Names with affiliations (superscript numbers)

  const lines = text.split("\n").slice(0, 20); // First 20 lines
  const authors: string[] = [];

  for (const line of lines) {
    // Skip very short or very long lines
    if (line.length < 5 || line.length > 200) continue;

    // Skip lines that look like headers/sections
    if (/^(abstract|introduction|keywords|1\.|I\.)/i.test(line.trim())) break;

    // Look for lines with multiple capitalized names
    const namePattern = /([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
    const matches = line.match(namePattern);

    if (matches && matches.length >= 1 && matches.length <= 10) {
      for (const match of matches) {
        // Convert "First Last" to "Last, First"
        const parts = match.split(/\s+/);
        if (parts.length >= 2) {
          const lastName = parts[parts.length - 1];
          const firstName = parts.slice(0, -1).join(" ");
          authors.push(`${lastName}, ${firstName}`);
        }
      }
      if (authors.length > 0) break; // Found author line
    }
  }

  return authors.slice(0, 20); // Max 20 authors
}

/**
 * Parse year from text
 */
function parseYearFromText(text: string): number | undefined {
  // Look for 4-digit year patterns, prefer recent years
  const yearPattern = /\b(19[89]\d|20[0-2]\d)\b/g;
  const matches = text.match(yearPattern);

  if (matches && matches.length > 0) {
    // Return the most recent year found
    const years = matches.map(Number).sort((a, b) => b - a);
    return years[0];
  }

  return undefined;
}

/**
 * Try to extract BibTeX metadata from PDF
 * Attempts multiple methods in order of reliability
 */
export async function extractBibTeXFromPdf(
  filePath: string,
  existingTitle?: string,
  existingAuthor?: string
): Promise<BibTeXMetadata> {
  // Start with a basic entry
  const metadata: BibTeXMetadata = {
    entryType: "misc",
    citeKey: "",
    title: existingTitle || "Untitled",
    authors: existingAuthor ? [existingAuthor] : [],
    extractedAt: new Date(),
    extractionMethod: "manual",
    confidence: 0.3,
  };

  try {
    // Step 1: Try to extract text from first page
    const text = await extractPdfText(filePath, [1]);

    if (text) {
      // Step 2: Look for DOI in the text
      const doi = extractDoiFromText(text);

      if (doi) {
        // Step 3: If DOI found, fetch from CrossRef
        const crossRefData = await fetchFromCrossRef(doi);

        if (crossRefData) {
          return crossRefData; // Best quality data
        }

        // Even if CrossRef fails, store the DOI
        metadata.doi = doi;
        metadata.confidence = 0.6;
      }

      // Step 4: Parse what we can from text
      if (metadata.authors.length === 0) {
        const parsedAuthors = parseAuthorsFromText(text);
        if (parsedAuthors.length > 0) {
          metadata.authors = parsedAuthors;
          metadata.confidence = Math.max(metadata.confidence ?? 0, 0.5);
        }
      }

      const parsedYear = parseYearFromText(text);
      if (parsedYear) {
        metadata.year = parsedYear;
      }

      metadata.extractionMethod = "text_parsing";
    }
  } catch (error) {
    console.warn("Error extracting BibTeX from PDF:", error);
  }

  // Generate cite key
  metadata.citeKey = generateCiteKey(metadata);

  return metadata;
}

/**
 * Download .bib file
 */
export function downloadBibFile(content: string, filename: string = "references.bib"): void {
  const blob = new Blob([content], { type: "application/x-bibtex" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse a BibTeX string into metadata (for import)
 */
export function parseBibTeXEntry(bibtex: string): BibTeXMetadata | null {
  try {
    // Match @type{key, ... }
    const entryMatch = bibtex.match(/@(\w+)\s*\{\s*([^,]+)\s*,/);
    if (!entryMatch) return null;

    const entryType = entryMatch[1].toLowerCase() as BibTeXEntryType;
    const citeKey = entryMatch[2].trim();

    // Extract fields
    const fieldPattern = /(\w+)\s*=\s*\{([^}]*)\}/g;
    const fields: Record<string, string> = {};
    let match;

    while ((match = fieldPattern.exec(bibtex)) !== null) {
      fields[match[1].toLowerCase()] = match[2].trim();
    }

    const metadata: BibTeXMetadata = {
      entryType,
      citeKey,
      title: fields.title || "Untitled",
      authors: fields.author?.split(/\s+and\s+/i) || [],
      year: fields.year ? parseInt(fields.year) : undefined,
      journal: fields.journal,
      booktitle: fields.booktitle,
      volume: fields.volume,
      number: fields.number,
      pages: fields.pages,
      publisher: fields.publisher,
      doi: fields.doi,
      url: fields.url,
      isbn: fields.isbn,
      issn: fields.issn,
      abstract: fields.abstract,
      keywords: fields.keywords?.split(/\s*,\s*/),
      note: fields.note,
      extractedAt: new Date(),
      extractionMethod: "manual",
    };

    return metadata;
  } catch {
    return null;
  }
}
