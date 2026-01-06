import { useState, useRef, useEffect, useCallback } from "react";
import { useAnnotationStore } from "../../stores";
import type { TextBoxAnnotation, TextStyle } from "../../types";
import { Bold, Italic, Underline, X, Check } from "lucide-react";

interface TextBoxLayerProps {
  pageNumber: number;
  scale: number;
  width: number;
  height: number;
  marginOffset?: number;
}

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "Arial",
  fontSize: 14,
  fontColor: "#000000",
  bold: false,
  italic: false,
  underline: false,
};

const FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
  "Comic Sans MS",
];

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

export function TextBoxLayer({
  pageNumber,
  scale,
  width,
  height,
  marginOffset = 0,
}: TextBoxLayerProps) {
  const {
    currentTool,
    getCurrentColor,
    getAnnotationsForPage,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    selectAnnotation,
    selectedAnnotationId,
  } = useAnnotationStore();

  const currentColor = getCurrentColor();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editStyle, setEditStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const [isCreating, setIsCreating] = useState(false);
  const [createPosition, setCreatePosition] = useState<{ x: number; y: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const annotations = getAnnotationsForPage(pageNumber);
  const textBoxAnnotations = annotations.filter(
    (a): a is TextBoxAnnotation => a.type === "textbox"
  );

  // Handle click to create new textbox
  const handleLayerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (currentTool !== "text") return;
      if (editingId) return; // Don't create new if editing

      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left - marginOffset) / scale;
      const y = (e.clientY - rect.top) / scale;

      setCreatePosition({ x, y });
      setIsCreating(true);
      setEditContent("");
      setEditStyle({ ...DEFAULT_TEXT_STYLE, fontColor: currentColor });
    },
    [currentTool, editingId, marginOffset, scale, currentColor]
  );

  // Save new textbox
  const handleSaveNew = useCallback(() => {
    if (!createPosition || !editContent.trim()) {
      setIsCreating(false);
      setCreatePosition(null);
      return;
    }

    const annotation: TextBoxAnnotation = {
      id: crypto.randomUUID(),
      type: "textbox",
      pageNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
      color: editStyle.fontColor,
      position: createPosition,
      width: 200,
      height: 100,
      content: editContent,
      style: editStyle,
    };

    addAnnotation(annotation);
    setIsCreating(false);
    setCreatePosition(null);
    setEditContent("");
  }, [createPosition, editContent, editStyle, pageNumber, addAnnotation]);

  // Start editing existing textbox
  const handleTextBoxClick = useCallback(
    (annotation: TextBoxAnnotation, e: React.MouseEvent) => {
      e.stopPropagation();
      selectAnnotation(annotation.id);
      setEditingId(annotation.id);
      setEditContent(annotation.content);
      setEditStyle(annotation.style);
    },
    [selectAnnotation]
  );

  // Save edited textbox
  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;

    updateAnnotation(editingId, {
      content: editContent,
      style: editStyle,
      color: editStyle.fontColor,
      updatedAt: new Date(),
    });

    setEditingId(null);
    setEditContent("");
  }, [editingId, editContent, editStyle, updateAnnotation]);

  // Delete textbox
  const handleDelete = useCallback(
    (id: string) => {
      deleteAnnotation(id);
      setEditingId(null);
    },
    [deleteAnnotation]
  );

  // Cancel editing/creating
  const handleCancel = useCallback(() => {
    setEditingId(null);
    setIsCreating(false);
    setCreatePosition(null);
    setEditContent("");
  }, []);

  // Focus textarea when editing starts
  useEffect(() => {
    if ((editingId || isCreating) && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingId, isCreating]);

  // Style editor component
  const StyleEditor = ({ style, onChange }: { style: TextStyle; onChange: (style: TextStyle) => void }) => (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-t border-b border-gray-200 dark:border-gray-600">
      {/* Font Family */}
      <select
        value={style.fontFamily}
        onChange={(e) => onChange({ ...style, fontFamily: e.target.value })}
        className="text-xs px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
      >
        {FONT_FAMILIES.map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </select>

      {/* Font Size */}
      <select
        value={style.fontSize}
        onChange={(e) => onChange({ ...style, fontSize: Number(e.target.value) })}
        className="text-xs px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 w-14"
      >
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}px
          </option>
        ))}
      </select>

      {/* Font Color */}
      <input
        type="color"
        value={style.fontColor}
        onChange={(e) => onChange({ ...style, fontColor: e.target.value })}
        className="w-6 h-6 rounded cursor-pointer border border-gray-300"
      />

      {/* Bold */}
      <button
        onClick={() => onChange({ ...style, bold: !style.bold })}
        className={`p-1 rounded ${style.bold ? "bg-blue-500 text-white" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </button>

      {/* Italic */}
      <button
        onClick={() => onChange({ ...style, italic: !style.italic })}
        className={`p-1 rounded ${style.italic ? "bg-blue-500 text-white" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </button>

      {/* Underline */}
      <button
        onClick={() => onChange({ ...style, underline: !style.underline })}
        className={`p-1 rounded ${style.underline ? "bg-blue-500 text-white" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}
        title="Underline"
      >
        <Underline className="w-4 h-4" />
      </button>
    </div>
  );

  // Render textbox editor
  const renderEditor = (position: { x: number; y: number }, isNew: boolean, annotationId?: string) => (
    <div
      className="absolute bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-300 dark:border-gray-600 z-50"
      style={{
        left: position.x * scale + marginOffset,
        top: position.y * scale,
        minWidth: 280,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <StyleEditor style={editStyle} onChange={setEditStyle} />
      <textarea
        ref={textareaRef}
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        className="w-full p-2 min-h-[80px] resize-y bg-transparent focus:outline-none"
        style={{
          fontFamily: editStyle.fontFamily,
          fontSize: editStyle.fontSize,
          color: editStyle.fontColor,
          fontWeight: editStyle.bold ? "bold" : "normal",
          fontStyle: editStyle.italic ? "italic" : "normal",
          textDecoration: editStyle.underline ? "underline" : "none",
        }}
        placeholder="Enter text..."
      />
      <div className="flex justify-end gap-2 p-2 border-t border-gray-200 dark:border-gray-600">
        {!isNew && annotationId && (
          <button
            onClick={() => handleDelete(annotationId)}
            className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          >
            Delete
          </button>
        )}
        <button
          onClick={handleCancel}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={isNew ? handleSaveNew : handleSaveEdit}
          className="p-1 bg-blue-500 text-white hover:bg-blue-600 rounded"
          title="Save"
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`absolute inset-0 ${currentTool === "text" && !editingId && !isCreating ? "cursor-text pointer-events-auto" : "pointer-events-none"}`}
      style={{ width, height, zIndex: 5 }}
      onClick={handleLayerClick}
    >
      {/* Render existing textboxes */}
      {textBoxAnnotations.map((annotation) => {
        const isEditing = editingId === annotation.id;
        const isSelected = selectedAnnotationId === annotation.id;

        if (isEditing) {
          return (
            <div key={annotation.id}>
              {renderEditor(annotation.position, false, annotation.id)}
            </div>
          );
        }

        return (
          <div
            key={annotation.id}
            className={`absolute pointer-events-auto cursor-pointer transition-shadow ${
              isSelected ? "ring-2 ring-blue-500" : "hover:ring-2 hover:ring-blue-300"
            }`}
            style={{
              left: annotation.position.x * scale + marginOffset,
              top: annotation.position.y * scale,
              minWidth: 50,
              padding: 4,
              backgroundColor: annotation.backgroundColor || "transparent",
              borderColor: annotation.borderColor,
              borderWidth: annotation.borderColor ? 1 : 0,
              borderStyle: "solid",
              borderRadius: 4,
            }}
            onClick={(e) => handleTextBoxClick(annotation, e)}
          >
            <div
              style={{
                fontFamily: annotation.style.fontFamily,
                fontSize: annotation.style.fontSize * scale,
                color: annotation.style.fontColor,
                fontWeight: annotation.style.bold ? "bold" : "normal",
                fontStyle: annotation.style.italic ? "italic" : "normal",
                textDecoration: annotation.style.underline ? "underline" : "none",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {annotation.content || <span className="text-gray-400 italic">Empty text</span>}
            </div>
          </div>
        );
      })}

      {/* Render new textbox editor */}
      {isCreating && createPosition && renderEditor(createPosition, true)}
    </div>
  );
}
