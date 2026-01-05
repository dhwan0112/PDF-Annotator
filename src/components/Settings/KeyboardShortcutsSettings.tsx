import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "../../stores";
import type { KeyBinding } from "../../stores";
import { RotateCcw, X } from "lucide-react";

interface KeyboardShortcutsSettingsProps {
  onClose: () => void;
}

export function KeyboardShortcutsSettings({ onClose }: KeyboardShortcutsSettingsProps) {
  const { getShortcutsByCategory, setShortcut, resetShortcut, resetAllShortcuts, formatShortcut } =
    useSettingsStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<KeyBinding | null>(null);

  const categories = getShortcutsByCategory();

  // Record key combination
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!editingId) return;
      e.preventDefault();

      // Skip modifier-only keys
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        return;
      }

      const binding: KeyBinding = {
        key: e.key,
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      };

      setRecordedKeys(binding);
    },
    [editingId]
  );

  useEffect(() => {
    if (editingId) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [editingId, handleKeyDown]);

  const saveShortcut = () => {
    if (editingId && recordedKeys) {
      setShortcut(editingId, recordedKeys);
      setEditingId(null);
      setRecordedKeys(null);
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setRecordedKeys(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm("Reset all shortcuts to defaults?")) {
                  resetAllShortcuts();
                }
              }}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              Reset All
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {Object.entries(categories).map(([category, shortcuts]) => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {category}
              </h3>
              <div className="space-y-1">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {shortcut.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {editingId === shortcut.id ? (
                        <>
                          <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded text-sm min-w-[100px] text-center">
                            {recordedKeys ? formatShortcut(recordedKeys) : "Press keys..."}
                          </div>
                          <button
                            onClick={saveShortcut}
                            disabled={!recordedKeys}
                            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(shortcut.id);
                              setRecordedKeys(null);
                            }}
                            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600 min-w-[100px] text-center font-mono"
                          >
                            {formatShortcut(shortcut.binding)}
                          </button>
                          <button
                            onClick={() => resetShortcut(shortcut.id)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                            title="Reset to default"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          Click on a shortcut to edit it. Press the desired key combination, then click Save.
        </div>
      </div>
    </div>
  );
}
