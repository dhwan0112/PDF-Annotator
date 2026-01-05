import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";

export interface Document {
  id: string;
  file_path: string;
  file_name: string;
  title: string | null;
  author: string | null;
  page_count: number | null;
  last_page: number;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

interface LibraryState {
  // Data
  documents: Document[];
  projects: Project[];
  tags: Tag[];
  documentTags: Map<string, string[]>; // document_id -> tag_ids

  // UI State
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  selectedProjectId: string | null;
  selectedTagIds: string[];
  searchQuery: string;
  viewMode: "grid" | "list";

  // Actions
  initLibrary: () => Promise<void>;

  // Document actions
  addDocument: (filePath: string, fileName: string, title?: string, author?: string, pageCount?: number) => Promise<Document | null>;
  loadDocuments: () => Promise<void>;
  loadDocumentsByProject: (projectId: string | null) => Promise<void>;
  updateDocumentProgress: (documentId: string, page: number) => Promise<void>;
  setDocumentProject: (documentId: string, projectId: string | null) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  searchDocuments: (query: string) => Promise<void>;

  // Project actions
  addProject: (name: string) => Promise<Project | null>;
  loadProjects: () => Promise<void>;
  updateProject: (id: string, name: string, description?: string, color?: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;

  // Tag actions
  addTag: (name: string, color?: string) => Promise<Tag | null>;
  loadTags: () => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  addDocumentTag: (documentId: string, tagId: string) => Promise<void>;
  removeDocumentTag: (documentId: string, tagId: string) => Promise<void>;
  loadDocumentTags: (documentId: string) => Promise<void>;

  // UI actions
  setSelectedProject: (projectId: string | null) => void;
  setSelectedTags: (tagIds: string[]) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: "grid" | "list") => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  // Initial state
  documents: [],
  projects: [],
  tags: [],
  documentTags: new Map(),
  isInitialized: false,
  isLoading: false,
  error: null,
  selectedProjectId: null,
  selectedTagIds: [],
  searchQuery: "",
  viewMode: "grid",

  // Initialize library
  initLibrary: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true, error: null });
    try {
      const dataDir = await appDataDir();
      await invoke("init_database", { appDataDir: dataDir });

      await Promise.all([
        get().loadDocuments(),
        get().loadProjects(),
        get().loadTags(),
      ]);

      set({ isInitialized: true });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to initialize library" });
    } finally {
      set({ isLoading: false });
    }
  },

  // Document actions
  addDocument: async (filePath, fileName, title, author, pageCount) => {
    try {
      const doc = await invoke<Document>("add_document_to_library", {
        filePath,
        fileName,
        title: title ?? null,
        author: author ?? null,
        pageCount: pageCount ?? null,
      });

      set(state => ({
        documents: state.documents.some(d => d.id === doc.id)
          ? state.documents.map(d => d.id === doc.id ? doc : d)
          : [...state.documents, doc]
      }));

      return doc;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to add document" });
      return null;
    }
  },

  loadDocuments: async () => {
    try {
      const docs = await invoke<Document[]>("get_all_documents");
      set({ documents: docs });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load documents" });
    }
  },

  loadDocumentsByProject: async (projectId) => {
    try {
      const docs = await invoke<Document[]>("get_documents_by_project", {
        projectId: projectId ?? null
      });
      set({ documents: docs });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load documents" });
    }
  },

  updateDocumentProgress: async (documentId, page) => {
    try {
      await invoke("update_document_progress", { documentId, page });
      set(state => ({
        documents: state.documents.map(d =>
          d.id === documentId ? { ...d, last_page: page } : d
        )
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update progress" });
    }
  },

  setDocumentProject: async (documentId, projectId) => {
    try {
      await invoke("set_document_project", { documentId, projectId: projectId ?? null });
      set(state => ({
        documents: state.documents.map(d =>
          d.id === documentId ? { ...d, project_id: projectId } : d
        )
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to set project" });
    }
  },

  deleteDocument: async (documentId) => {
    try {
      await invoke("delete_document_from_library", { documentId });
      set(state => ({
        documents: state.documents.filter(d => d.id !== documentId)
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete document" });
    }
  },

  searchDocuments: async (query) => {
    try {
      if (!query.trim()) {
        await get().loadDocuments();
        return;
      }
      const docs = await invoke<Document[]>("search_documents", { query });
      set({ documents: docs });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to search documents" });
    }
  },

  // Project actions
  addProject: async (name) => {
    try {
      const project = await invoke<Project>("add_project", { name });
      set(state => ({ projects: [...state.projects, project] }));
      return project;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to add project" });
      return null;
    }
  },

  loadProjects: async () => {
    try {
      const projects = await invoke<Project[]>("get_all_projects");
      set({ projects });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load projects" });
    }
  },

  updateProject: async (id, name, description, color) => {
    try {
      await invoke("update_project", {
        id,
        name,
        description: description ?? null,
        color: color ?? null
      });
      set(state => ({
        projects: state.projects.map(p =>
          p.id === id ? { ...p, name, description: description ?? null, color: color ?? null } : p
        )
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update project" });
    }
  },

  deleteProject: async (projectId) => {
    try {
      await invoke("delete_project", { projectId });
      set(state => ({
        projects: state.projects.filter(p => p.id !== projectId),
        selectedProjectId: state.selectedProjectId === projectId ? null : state.selectedProjectId
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete project" });
    }
  },

  // Tag actions
  addTag: async (name, color) => {
    try {
      const tag = await invoke<Tag>("add_tag", { name, color: color ?? null });
      set(state => ({ tags: [...state.tags, tag] }));
      return tag;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to add tag" });
      return null;
    }
  },

  loadTags: async () => {
    try {
      const tags = await invoke<Tag[]>("get_all_tags");
      set({ tags });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load tags" });
    }
  },

  deleteTag: async (tagId) => {
    try {
      await invoke("delete_tag", { tagId });
      set(state => ({
        tags: state.tags.filter(t => t.id !== tagId),
        selectedTagIds: state.selectedTagIds.filter(id => id !== tagId)
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete tag" });
    }
  },

  addDocumentTag: async (documentId, tagId) => {
    try {
      await invoke("add_document_tag", { documentId, tagId });
      set(state => {
        const newMap = new Map(state.documentTags);
        const current = newMap.get(documentId) || [];
        if (!current.includes(tagId)) {
          newMap.set(documentId, [...current, tagId]);
        }
        return { documentTags: newMap };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to add tag to document" });
    }
  },

  removeDocumentTag: async (documentId, tagId) => {
    try {
      await invoke("remove_document_tag", { documentId, tagId });
      set(state => {
        const newMap = new Map(state.documentTags);
        const current = newMap.get(documentId) || [];
        newMap.set(documentId, current.filter(id => id !== tagId));
        return { documentTags: newMap };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to remove tag from document" });
    }
  },

  loadDocumentTags: async (documentId) => {
    try {
      const tags = await invoke<Tag[]>("get_document_tags", { documentId });
      set(state => {
        const newMap = new Map(state.documentTags);
        newMap.set(documentId, tags.map(t => t.id));
        return { documentTags: newMap };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load document tags" });
    }
  },

  // UI actions
  setSelectedProject: (projectId) => set({ selectedProjectId: projectId }),
  setSelectedTags: (tagIds) => set({ selectedTagIds: tagIds }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
