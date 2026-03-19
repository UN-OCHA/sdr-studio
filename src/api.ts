import type {
  Annotation,
  ArticleUpdate,
  ProjectCreate,
  ProjectUpdate,
  TrainingRequest,
  ProjectTemplateCreate,
  ProjectTemplateUpdate,
} from "./types";

const API_BASE_URL = "/api";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token might be expired
      console.error("Unauthorized access - token may be expired");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || "API request failed");
    }

    // For file downloads (CSV), handle blob
    const contentType = response.headers.get("content-type");
    if (contentType && (contentType.includes("text/csv") || contentType.includes("application/octet-stream"))) {
      return response.blob();
    }

    return response.json();
  } catch (error) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error;
  }
}

export const projectsApi = {
  list: () => apiFetch("/projects"),
  get: (id: string) => apiFetch(`/projects/${id}`),
  create: (data: ProjectCreate) =>
    apiFetch("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: ProjectUpdate) =>
    apiFetch(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  listArticles: (
    projectId: string,
    params: {
      search?: string;
      status?: string;
      skip?: number;
      limit?: number;
      sort_by?: string;
      sort_order?: "asc" | "desc";
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.search) query.append("search", params.search);
    if (params.status) query.append("status", params.status);
    if (params.skip !== undefined) query.append("skip", params.skip.toString());
    if (params.limit !== undefined) query.append("limit", params.limit.toString());
    if (params.sort_by) query.append("sort_by", params.sort_by);
    if (params.sort_order) query.append("sort_order", params.sort_order);

    const queryString = query.toString();
    return apiFetch(`/projects/${projectId}/articles${queryString ? `?${queryString}` : ""}`);
  },
  bulkDeleteArticles: (projectId: string, articleIds: string[]) =>
    apiFetch(`/projects/${projectId}/articles/bulk-delete`, {
      method: "POST",
      body: JSON.stringify(articleIds),
    }),
  importUrls: (projectId: string, urls: string[]) =>
    apiFetch(`/projects/${projectId}/import`, {
      method: "POST",
      body: JSON.stringify({ urls }),
    }),
  reprocess: (id: string) =>
    apiFetch(`/projects/${id}/reprocess`, {
      method: "POST",
    }),
  getStats: (id: string) => apiFetch(`/projects/${id}/stats`),
  delete: (id: string) =>
    apiFetch(`/projects/${id}`, {
      method: "DELETE",
    }),
  getExportToken: () => apiFetch("/export-token", { method: "POST" }),
  exportJsonUrl: (projectId: string, token: string, articleIds?: string[]) => {
    const query = new URLSearchParams();
    if (articleIds) query.append("article_ids", articleIds.join(","));
    query.append("token", token);
    const qs = query.toString();
    return `${API_BASE_URL}/projects/${projectId}/export/json${qs ? `?${qs}` : ""}`;
  },
  exportCsvUrl: (projectId: string, token: string, article_ids?: string[]) => {
    const query = new URLSearchParams();
    if (article_ids) query.append("article_ids", article_ids.join(","));
    query.append("token", token);
    const qs = query.toString();
    return `${API_BASE_URL}/projects/${projectId}/export/csv${qs ? `?${qs}` : ""}`;
  },
  exportReportUrl: (projectId: string, token: string, format: "md" | "pdf", article_ids?: string[]) => {
    const query = new URLSearchParams();
    query.append("format", format);
    if (article_ids) query.append("article_ids", article_ids.join(","));
    query.append("token", token);
    const qs = query.toString();
    return `${API_BASE_URL}/projects/${projectId}/export/report?${qs}`;
  },
  getReportPreview: (projectId: string, reportConfig: any) =>
    apiFetch(`/projects/${projectId}/export/report-preview`, {
      method: "POST",
      body: JSON.stringify(reportConfig),
    }),
  listAdapters: (projectId: string) => apiFetch(`/projects/${projectId}/adapters`),
  trainAdapter: (projectId: string, data: TrainingRequest) =>
    apiFetch(`/projects/${projectId}/train`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  activateAdapter: (projectId: string, adapterId: string) =>
    apiFetch(`/projects/${projectId}/activate-adapter/${adapterId}`, {
      method: "POST",
    }),
  deactivateAdapter: (projectId: string) =>
    apiFetch(`/projects/${projectId}/deactivate-adapter`, {
      method: "POST",
    }),
};

export const sourcesApi = {
  list: (projectId: string) => apiFetch(`/projects/${projectId}/sources`),
  create: (projectId: string, data: { name: string; url: string; type: string }) =>
    apiFetch(`/projects/${projectId}/sources`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (sourceId: string, data: { active?: boolean; name?: string; url?: string }) =>
    apiFetch(`/sources/${sourceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (sourceId: string) =>
    apiFetch(`/sources/${sourceId}`, {
      method: "DELETE",
    }),
};

export const articlesApi = {
  get: (id: string) => apiFetch(`/articles/${id}`),
  process: (id: string) =>
    apiFetch(`/articles/${id}/process`, {
      method: "POST",
    }),
  updateAnnotations: (id: string, annotations: Annotation[]) =>
    apiFetch(`/articles/${id}/annotations`, {
      method: "PATCH",
      body: JSON.stringify({ annotations }),
    }),
  update: (id: string, data: ArticleUpdate) =>
    apiFetch(`/articles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiFetch(`/articles/${id}`, {
      method: "DELETE",
    }),
};

export const templatesApi = {
  list: () => apiFetch("/templates"),
  get: (id: string) => apiFetch(`/templates/${id}`),
  create: (data: ProjectTemplateCreate) =>
    apiFetch("/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: ProjectTemplateUpdate) =>
    apiFetch(`/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiFetch(`/templates/${id}`, {
      method: "DELETE",
    }),
};
