import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StudyGroup, MarginNote } from "../types";

interface StudyGroupState {
  // Study Groups
  studyGroups: StudyGroup[];
  activeStudyGroupId: string | null;

  // Margin Notes (indexed by documentId)
  marginNotes: Map<string, MarginNote[]>;

  // Study Group Actions
  createStudyGroup: (name: string, description?: string, color?: string) => string;
  updateStudyGroup: (id: string, updates: Partial<Omit<StudyGroup, "id" | "createdAt">>) => void;
  deleteStudyGroup: (id: string) => void;
  setActiveStudyGroup: (id: string | null) => void;
  addDocumentToGroup: (groupId: string, documentId: string) => void;
  removeDocumentFromGroup: (groupId: string, documentId: string) => void;
  getStudyGroup: (id: string) => StudyGroup | undefined;
  getGroupForDocument: (documentId: string) => StudyGroup | undefined;
  toggleGroupCollapsed: (groupId: string) => void;

  // Margin Note Actions
  addMarginNote: (note: Omit<MarginNote, "id" | "createdAt" | "updatedAt">) => string;
  updateMarginNote: (id: string, updates: Partial<Omit<MarginNote, "id" | "createdAt">>) => void;
  deleteMarginNote: (id: string) => void;
  getMarginNotesForDocument: (documentId: string) => MarginNote[];
  getMarginNotesForPage: (documentId: string, pageNumber: number) => MarginNote[];
  linkAnnotationToMarginNote: (noteId: string, annotationId: string) => void;
}

export const GROUP_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
];

export const useStudyGroupStore = create<StudyGroupState>()(
  persist(
    (set, get) => ({
      studyGroups: [],
      activeStudyGroupId: null,
      marginNotes: new Map(),

      // Study Group Actions
      createStudyGroup: (name, description, color) => {
        const id = crypto.randomUUID();
        const newGroup: StudyGroup = {
          id,
          name,
          description,
          color: color || GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)],
          documentIds: [],
          collapsed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({
          studyGroups: [...state.studyGroups, newGroup],
        }));
        return id;
      },

      updateStudyGroup: (id, updates) => {
        set((state) => ({
          studyGroups: state.studyGroups.map((g) =>
            g.id === id ? { ...g, ...updates, updatedAt: new Date() } : g
          ),
        }));
      },

      deleteStudyGroup: (id) => {
        set((state) => ({
          studyGroups: state.studyGroups.filter((g) => g.id !== id),
          activeStudyGroupId: state.activeStudyGroupId === id ? null : state.activeStudyGroupId,
        }));
      },

      setActiveStudyGroup: (id) => {
        set({ activeStudyGroupId: id });
      },

      addDocumentToGroup: (groupId, documentId) => {
        set((state) => ({
          studyGroups: state.studyGroups.map((g) =>
            g.id === groupId && !g.documentIds.includes(documentId)
              ? { ...g, documentIds: [...g.documentIds, documentId], updatedAt: new Date() }
              : g
          ),
        }));
      },

      removeDocumentFromGroup: (groupId, documentId) => {
        set((state) => ({
          studyGroups: state.studyGroups.map((g) =>
            g.id === groupId
              ? { ...g, documentIds: g.documentIds.filter((d) => d !== documentId), updatedAt: new Date() }
              : g
          ),
        }));
      },

      getStudyGroup: (id) => {
        return get().studyGroups.find((g) => g.id === id);
      },

      getGroupForDocument: (documentId) => {
        return get().studyGroups.find((g) => g.documentIds.includes(documentId));
      },

      toggleGroupCollapsed: (groupId) => {
        set((state) => ({
          studyGroups: state.studyGroups.map((g) =>
            g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
          ),
        }));
      },

      // Margin Note Actions
      addMarginNote: (noteData) => {
        const id = crypto.randomUUID();
        const note: MarginNote = {
          ...noteData,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => {
          const newMap = new Map(state.marginNotes);
          const docNotes = newMap.get(note.documentId) || [];
          newMap.set(note.documentId, [...docNotes, note]);
          return { marginNotes: newMap };
        });
        return id;
      },

      updateMarginNote: (id, updates) => {
        set((state) => {
          const newMap = new Map(state.marginNotes);
          for (const [docId, notes] of newMap) {
            const noteIndex = notes.findIndex((n) => n.id === id);
            if (noteIndex !== -1) {
              const updatedNotes = [...notes];
              updatedNotes[noteIndex] = {
                ...updatedNotes[noteIndex],
                ...updates,
                updatedAt: new Date(),
              };
              newMap.set(docId, updatedNotes);
              break;
            }
          }
          return { marginNotes: newMap };
        });
      },

      deleteMarginNote: (id) => {
        set((state) => {
          const newMap = new Map(state.marginNotes);
          for (const [docId, notes] of newMap) {
            const filtered = notes.filter((n) => n.id !== id);
            if (filtered.length !== notes.length) {
              newMap.set(docId, filtered);
              break;
            }
          }
          return { marginNotes: newMap };
        });
      },

      getMarginNotesForDocument: (documentId) => {
        return get().marginNotes.get(documentId) || [];
      },

      getMarginNotesForPage: (documentId, pageNumber) => {
        const notes = get().marginNotes.get(documentId) || [];
        return notes.filter((n) => n.pageNumber === pageNumber);
      },

      linkAnnotationToMarginNote: (noteId, annotationId) => {
        get().updateMarginNote(noteId, { linkedAnnotationId: annotationId });
      },
    }),
    {
      name: "marginalia-study-groups",
      partialize: (state) => ({
        studyGroups: state.studyGroups,
        marginNotes: Array.from(state.marginNotes.entries()),
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as {
          studyGroups?: StudyGroup[];
          marginNotes?: [string, MarginNote[]][];
        };
        return {
          ...current,
          studyGroups: persistedState.studyGroups || [],
          marginNotes: new Map(persistedState.marginNotes || []),
        };
      },
    }
  )
);
