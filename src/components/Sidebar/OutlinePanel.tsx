import { useEffect, useState, memo } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { usePdfStore } from "../../stores";
import { ChevronRight, ChevronDown, FileText } from "lucide-react";

interface OutlineItem {
  title: string;
  bold: boolean;
  italic: boolean;
  color: Uint8ClampedArray;
  dest: string | unknown[] | null;
  url: string | null;
  unsafeUrl: string | undefined;
  newWindow: boolean | undefined;
  count: number | undefined;
  items: OutlineItem[];
}

interface OutlinePanelProps {
  pdfDocument: PDFDocumentProxy | null;
}

export function OutlinePanel({ pdfDocument }: OutlinePanelProps) {
  const [outline, setOutline] = useState<OutlineItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfDocument) {
      setOutline(null);
      return;
    }

    setLoading(true);
    setError(null);

    pdfDocument.getOutline()
      .then((result) => {
        setOutline(result as OutlineItem[] | null);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to get outline:", err);
        setError("Failed to load outline");
        setLoading(false);
      });
  }, [pdfDocument]);

  if (!pdfDocument) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm">
        Load a PDF to see its outline.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 dark:text-red-400 text-sm p-2">
        {error}
      </div>
    );
  }

  if (!outline || outline.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm">
        This document has no outline.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="space-y-0.5">
        {outline.map((item, index) => (
          <OutlineItemComponent
            key={`${item.title}-${index}`}
            item={item}
            pdfDocument={pdfDocument}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}

interface OutlineItemComponentProps {
  item: OutlineItem;
  pdfDocument: PDFDocumentProxy;
  depth: number;
}

const OutlineItemComponent = memo(function OutlineItemComponent({
  item,
  pdfDocument,
  depth,
}: OutlineItemComponentProps) {
  const [expanded, setExpanded] = useState(depth < 2); // Auto-expand first 2 levels
  const { setCurrentPage } = usePdfStore();
  const hasChildren = item.items && item.items.length > 0;

  const handleClick = async () => {
    if (!item.dest) return;

    try {
      let pageIndex: number | null = null;

      if (typeof item.dest === "string") {
        // Named destination
        const dest = await pdfDocument.getDestination(item.dest);
        if (dest && dest[0]) {
          const ref = dest[0] as { num: number; gen: number };
          pageIndex = await pdfDocument.getPageIndex(ref);
        }
      } else if (Array.isArray(item.dest)) {
        // Explicit destination
        const ref = item.dest[0] as { num: number; gen: number } | null;
        if (ref && typeof ref === "object" && "num" in ref) {
          pageIndex = await pdfDocument.getPageIndex(ref);
        }
      }

      if (pageIndex !== null) {
        setCurrentPage(pageIndex + 1); // PDF.js uses 0-based index
      }
    } catch (err) {
      console.error("Failed to navigate to outline item:", err);
    }
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
          item.bold ? "font-semibold" : ""
        } ${item.italic ? "italic" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <button
            onClick={toggleExpand}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex-shrink-0"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            )}
          </button>
        ) : (
          <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-0.5" />
        )}
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
          {item.title}
        </span>
      </div>
      {hasChildren && expanded && (
        <div>
          {item.items.map((child, index) => (
            <OutlineItemComponent
              key={`${child.title}-${index}`}
              item={child}
              pdfDocument={pdfDocument}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});
