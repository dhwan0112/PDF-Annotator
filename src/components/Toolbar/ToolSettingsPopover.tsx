import { useState, useRef, useEffect } from "react";
import { useAnnotationStore, TOOL_COLOR_PRESETS } from "../../stores";
import type { AnnotationTool } from "../../types";
import { ArrowRight, Circle, Diamond, Minus } from "lucide-react";

interface ToolSettingsPopoverProps {
  tool: AnnotationTool;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

export function ToolSettingsPopover({
  tool,
  onClose,
  anchorEl,
}: ToolSettingsPopoverProps) {
  const {
    getToolSettings,
    setToolColor,
    setToolOpacity,
    setToolThickness,
    getArrowSettings,
    setArrowLineStyle,
    setArrowCurveStyle,
    setArrowHeadStyle,
    setArrowTailStyle,
  } = useAnnotationStore();
  const settings = getToolSettings(tool);
  const arrowSettings = getArrowSettings();
  const presets = TOOL_COLOR_PRESETS[tool] || TOOL_COLOR_PRESETS.pen;
  const popoverRef = useRef<HTMLDivElement>(null);

  // Position popover below anchor
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: Math.max(8, rect.left - 80),
      });
    }
  }, [anchorEl]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, anchorEl]);

  // Tool-specific settings
  const showColor = tool !== "select" && tool !== "eraser";
  const showOpacity = tool === "highlighter" || tool === "rect" || tool === "note";
  const showThickness =
    tool === "pen" ||
    tool === "highlighter" ||
    tool === "eraser" ||
    tool === "rect" ||
    tool === "arrow" ||
    tool === "underline" ||
    tool === "strikeout";

  const getThicknessLabel = () => {
    if (tool === "eraser") return "Size";
    if (tool === "highlighter") return "Width";
    return "Thickness";
  };

  const getThicknessRange = () => {
    if (tool === "eraser") return { min: 5, max: 50, step: 5 };
    if (tool === "highlighter") return { min: 10, max: 40, step: 5 };
    return { min: 1, max: 10, step: 1 };
  };

  const thicknessRange = getThicknessRange();

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[200px]"
      style={{ top: position.top, left: position.left }}
    >
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
        {tool.charAt(0).toUpperCase() + tool.slice(1)} Settings
      </div>

      {/* Color picker */}
      {showColor && (
        <div className="mb-3">
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">
            Color
          </label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((color) => (
              <button
                key={color}
                onClick={() => setToolColor(tool, color)}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  settings.color === color
                    ? "border-blue-500 ring-2 ring-blue-300"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            {/* Custom color input */}
            <label
              className="w-6 h-6 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-500 flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
              title="Custom color"
            >
              <input
                type="color"
                value={settings.color}
                onChange={(e) => setToolColor(tool, e.target.value)}
                className="sr-only"
              />
              <span className="text-xs text-gray-500">+</span>
            </label>
          </div>
        </div>
      )}

      {/* Opacity slider */}
      {showOpacity && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Opacity
            </label>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {Math.round(settings.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={settings.opacity * 100}
            onChange={(e) => setToolOpacity(tool, parseInt(e.target.value) / 100)}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      )}

      {/* Thickness slider */}
      {showThickness && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              {getThicknessLabel()}
            </label>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {settings.thickness}px
            </span>
          </div>
          <input
            type="range"
            min={thicknessRange.min}
            max={thicknessRange.max}
            step={thicknessRange.step}
            value={settings.thickness}
            onChange={(e) => setToolThickness(tool, parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          {/* Preview */}
          <div className="mt-2 flex items-center justify-center h-8 bg-gray-100 dark:bg-gray-700 rounded">
            <div
              className="rounded-full"
              style={{
                width: Math.min(settings.thickness * 2, 40),
                height: Math.min(settings.thickness * 2, 40),
                backgroundColor: showColor ? settings.color : "#6b7280",
                opacity: showOpacity ? settings.opacity : 1,
              }}
            />
          </div>
        </div>
      )}

      {/* Arrow-specific settings */}
      {tool === "arrow" && (
        <>
          {/* Line Style */}
          <div className="mb-3">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">
              Line Style
            </label>
            <div className="flex gap-1">
              {(["solid", "dashed", "dotted"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setArrowLineStyle(style)}
                  className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
                    arrowSettings.lineStyle === style
                      ? "bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-600"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {style.charAt(0).toUpperCase() + style.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Curve Style */}
          <div className="mb-3">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">
              Shape
            </label>
            <div className="flex gap-1">
              {(["straight", "curved"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setArrowCurveStyle(style)}
                  className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
                    arrowSettings.curveStyle === style
                      ? "bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-600"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {style.charAt(0).toUpperCase() + style.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Head Style */}
          <div className="mb-3">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">
              Head Style
            </label>
            <div className="flex gap-1">
              {[
                { value: "arrow" as const, icon: ArrowRight, label: "Arrow" },
                { value: "circle" as const, icon: Circle, label: "Circle" },
                { value: "diamond" as const, icon: Diamond, label: "Diamond" },
                { value: "none" as const, icon: Minus, label: "None" },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setArrowHeadStyle(value)}
                  className={`flex-1 p-1.5 rounded border transition-colors ${
                    arrowSettings.headStyle === value
                      ? "bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-600"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  title={label}
                >
                  <Icon className="w-4 h-4 mx-auto" />
                </button>
              ))}
            </div>
          </div>

          {/* Tail Style */}
          <div className="mb-1">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">
              Tail Style
            </label>
            <div className="flex gap-1">
              {[
                { value: "none" as const, icon: Minus, label: "None" },
                { value: "arrow" as const, icon: ArrowRight, label: "Arrow" },
                { value: "circle" as const, icon: Circle, label: "Circle" },
                { value: "diamond" as const, icon: Diamond, label: "Diamond" },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setArrowTailStyle(value)}
                  className={`flex-1 p-1.5 rounded border transition-colors ${
                    arrowSettings.tailStyle === value
                      ? "bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-600"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  title={label}
                >
                  <Icon className="w-4 h-4 mx-auto" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* No settings available */}
      {tool === "select" && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          No settings available for this tool.
        </div>
      )}
    </div>
  );
}
