import { create } from "zustand";
import type { Project, Article } from "./types";
import { projectsApi } from "./api";

interface AppState {
  projects: Project[];
  currentProjectId: string | null;
  articles: Article[];
  currentArticleId: string | null;
  isLoadingProjects: boolean;
  isLoadingArticles: boolean;
  errorProjects: string | null;
  errorArticles: string | null;
  isDarkMode: boolean;

  // Actions
  fetchProjects: () => Promise<void>;
  setCurrentProjectId: (id: string | null) => void;
  fetchArticles: (projectId: string) => Promise<void>;
  setCurrentArticleId: (id: string | null) => void;
  toggleDarkMode: () => void;
  
  // Helpers to update local state without full refetch
  updateProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  updateArticle: (article: Article) => void;
  deleteArticle: (articleId: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  projects: [],
  currentProjectId: localStorage.getItem("sdr_current_project_id"),
  articles: [],
  currentArticleId: null,
  isLoadingProjects: false,
  isLoadingArticles: false,
  errorProjects: null,
  errorArticles: null,
  isDarkMode: localStorage.getItem("sdr_dark_mode") === "true",

  fetchProjects: async () => {
    set({ isLoadingProjects: true, errorProjects: null });
    try {
      const projects = await projectsApi.list();
      set({ projects, isLoadingProjects: false, errorProjects: null });
      
      // If current project no longer exists, reset it
      const { currentProjectId } = get();
      if (currentProjectId && !projects.find((p: Project) => p.id === currentProjectId)) {
        get().setCurrentProjectId(null);
      }
    } catch (error: unknown) {
      console.error("Failed to fetch projects:", error);
      set({ 
        isLoadingProjects: false, 
        errorProjects: (error as Error).message || "Failed to connect to backend" 
      });
    }
  },

  setCurrentProjectId: (id) => {
    set({ currentProjectId: id });
    if (id) {
      localStorage.setItem("sdr_current_project_id", id);
      get().fetchArticles(id);
    } else {
      localStorage.removeItem("sdr_current_project_id");
      set({ articles: [], currentArticleId: null });
    }
  },

  fetchArticles: async (projectId) => {
    set({ isLoadingArticles: true, errorArticles: null });
    try {
      const response = await projectsApi.listArticles(projectId);
      set({ articles: response.articles, isLoadingArticles: false, errorArticles: null });
    } catch (error: unknown) {
      console.error("Failed to fetch articles:", error);
      set({ 
        isLoadingArticles: false, 
        errorArticles: (error as Error).message || "Failed to fetch articles" 
      });
    }
  },

  setCurrentArticleId: (id) => set({ currentArticleId: id }),

  toggleDarkMode: () => {
    const nextMode = !get().isDarkMode;
    set({ isDarkMode: nextMode });
    localStorage.setItem("sdr_dark_mode", String(nextMode));
  },

  updateProject: (project) => set((state) => ({
    projects: state.projects.map((p: Project) => p.id === project.id ? project : p)
  })),

  deleteProject: (projectId) => set((state) => ({
    projects: state.projects.filter((p: Project) => p.id !== projectId),
    currentProjectId: state.currentProjectId === projectId ? null : state.currentProjectId
  })),

  updateArticle: (article) => set((state) => ({
    articles: state.articles.map((a: Article) => a.id === article.id ? article : a)
  })),

  deleteArticle: (articleId) => set((state) => ({
    articles: state.articles.filter((a: Article) => a.id !== articleId),
    currentArticleId: state.currentArticleId === articleId ? null : state.currentArticleId
  })),
}));
