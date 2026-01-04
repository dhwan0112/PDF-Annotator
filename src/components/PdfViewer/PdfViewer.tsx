import { usePdfStore } from "../../stores";
import { FileText } from "lucide-react";

export function PdfViewer() {
  const { filePath, metadata } = usePdfStore();

  if (!filePath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        <FileText className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg mb-2">No PDF loaded</p>
        <p className="text-sm">
          Click "Open" or press Ctrl+O to open a PDF file
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-800">
      <div className="p-4">
        <div className="bg-white dark:bg-gray-700 rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            PDF Loaded
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex">
              <dt className="w-24 text-gray-500 dark:text-gray-400">File:</dt>
              <dd className="text-gray-900 dark:text-gray-100">
                {metadata?.fileName}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-gray-500 dark:text-gray-400">Path:</dt>
              <dd className="text-gray-900 dark:text-gray-100 break-all">
                {metadata?.path}
              </dd>
            </div>
            {metadata?.title && (
              <div className="flex">
                <dt className="w-24 text-gray-500 dark:text-gray-400">
                  Title:
                </dt>
                <dd className="text-gray-900 dark:text-gray-100">
                  {metadata.title}
                </dd>
              </div>
            )}
            {metadata?.author && (
              <div className="flex">
                <dt className="w-24 text-gray-500 dark:text-gray-400">
                  Author:
                </dt>
                <dd className="text-gray-900 dark:text-gray-100">
                  {metadata.author}
                </dd>
              </div>
            )}
            {metadata?.pageCount && (
              <div className="flex">
                <dt className="w-24 text-gray-500 dark:text-gray-400">
                  Pages:
                </dt>
                <dd className="text-gray-900 dark:text-gray-100">
                  {metadata.pageCount}
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-6 text-gray-500 dark:text-gray-400 text-sm italic">
            PDF rendering with pdfjs-dist will be implemented in the next phase.
          </p>
        </div>
      </div>
    </div>
  );
}
