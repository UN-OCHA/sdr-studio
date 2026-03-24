import type {
  Annotation,
  ArticleUpdate,
  ProjectCreate,
  ProjectUpdate,
  TrainingRequest,
  ProjectTemplateCreate,
  ProjectTemplateUpdate,
  ApiKeyCreate,
  Source,
  SourceCreate,
  SourceUpdate,
  Member,
  Organization,
  Invitation,
  Project,
  Article,
  ArticleListResponse,
  ProjectStats,
  ApiKey,
  ModelAdapter,
  ProjectTemplate,
} from "./types";

const API_BASE_URL = "/api";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/**
 * Core fetch utility for API communication.
 */
export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
      console.error("Unauthorized access - token may be expired");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || "API request failed");
    }

    const contentType = response.headers.get("content-type");
    if (contentType && (contentType.includes("text/csv") || contentType.includes("application/octet-stream"))) {
      return response.blob() as unknown as T;
    }

    return response.json();
  } catch (error) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error;
  }
}

// --- Projects ---

export const listProjects = () => apiFetch<Project[]>("/projects");

export const getProject = (id: string) => apiFetch<Project>(`/projects/${id}`);

export const createProject = (data: ProjectCreate) =>
  apiFetch<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateProject = (id: string, data: ProjectUpdate) =>
  apiFetch<Project>(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteProject = (id: string) =>
  apiFetch(`/projects/${id}`, {
    method: "DELETE",
  });

export const listProjectArticles = (
  projectId: string,
  params: {
    search?: string;
    status?: string;
    source_type?: string;
    skip?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: "asc" | "desc";
  } = {},
) => {
  const query = new URLSearchParams();
  if (params.search) query.append("search", params.search);
  if (params.status) query.append("status", params.status);
  if (params.source_type) query.append("source_type", params.source_type);
  if (params.skip !== undefined) query.append("skip", params.skip.toString());
  if (params.limit !== undefined) query.append("limit", params.limit.toString());
  if (params.sort_by) query.append("sort_by", params.sort_by);
  if (params.sort_order) query.append("sort_order", params.sort_order);

  const queryString = query.toString();
  return apiFetch<ArticleListResponse>(`/projects/${projectId}/articles${queryString ? `?${queryString}` : ""}`);
};

export const listProjectArticlesWithLocations = (projectId: string) =>
  apiFetch<Article[]>(`/projects/${projectId}/articles/locations`);

export const bulkDeleteArticles = (projectId: string, articleIds: string[]) =>
  apiFetch(`/projects/${projectId}/articles/bulk-delete`, {
    method: "POST",
    body: JSON.stringify(articleIds),
  });

export const bulkReprocessArticles = (projectId: string, articleIds: string[]) =>
  apiFetch(`/projects/${projectId}/articles/bulk-reprocess`, {
    method: "POST",
    body: JSON.stringify(articleIds),
  });

export const bulkMarkArticlesReviewed = (projectId: string, articleIds: string[], reviewed: boolean = true) =>
  apiFetch(`/projects/${projectId}/articles/bulk-mark-reviewed?reviewed=${reviewed}`, {
    method: "POST",
    body: JSON.stringify(articleIds),
  });

export const importUrls = (projectId: string, urls: string[]) =>
  apiFetch(`/projects/${projectId}/import`, {
    method: "POST",
    body: JSON.stringify({ urls }),
  });

export const discoverArticles = (projectId: string, data: { type: string; url: string; config?: Record<string, unknown> }) =>
  apiFetch(`/projects/${projectId}/discover`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const reprocessProject = (id: string) =>
  apiFetch(`/projects/${id}/reprocess`, {
    method: "POST",
  });

export const getProjectStats = (id: string) => apiFetch<ProjectStats>(`/projects/${id}/stats`);

export const getExportToken = () => apiFetch<{ token: string }>("/export-token", { method: "POST" });

export const getExportJsonUrl = (projectId: string, token: string, articleIds?: string[]) => {
  const query = new URLSearchParams();
  if (articleIds) query.append("article_ids", articleIds.join(","));
  query.append("token", token);
  const qs = query.toString();
  return `${API_BASE_URL}/projects/${projectId}/export/json${qs ? `?${qs}` : ""}`;
};

export const getExportCsvUrl = (projectId: string, token: string, article_ids?: string[]) => {
  const query = new URLSearchParams();
  if (article_ids) query.append("article_ids", article_ids.join(","));
  query.append("token", token);
  const qs = query.toString();
  return `${API_BASE_URL}/projects/${projectId}/export/csv${qs ? `?${qs}` : ""}`;
};

export const getExportReportUrl = (projectId: string, token: string, format: "md" | "pdf", article_ids?: string[]) => {
  const query = new URLSearchParams();
  query.append("format", format);
  if (article_ids) query.append("article_ids", article_ids.join(","));
  query.append("token", token);
  const qs = query.toString();
  return `${API_BASE_URL}/projects/${projectId}/export/report?${qs}`;
};

export const getReportPreview = (projectId: string, reportConfig: Record<string, unknown>) =>
  apiFetch(`/projects/${projectId}/export/report-preview`, {
    method: "POST",
    body: JSON.stringify(reportConfig),
  });

export const listModelAdapters = (projectId: string) => apiFetch<ModelAdapter[]>(`/projects/${projectId}/adapters`);

export const trainModelAdapter = (projectId: string, data: TrainingRequest) =>
  apiFetch<ModelAdapter>(`/projects/${projectId}/train`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const activateModelAdapter = (projectId: string, adapterId: string) =>
  apiFetch(`/projects/${projectId}/activate-adapter/${adapterId}`, {
    method: "POST",
  });

export const deactivateModelAdapter = (projectId: string) =>
  apiFetch(`/projects/${projectId}/deactivate-adapter`, {
    method: "POST",
  });

// --- API Keys ---

export const listApiKeys = (projectId: string) => apiFetch<ApiKey[]>(`/projects/${projectId}/api-keys`);

export const createApiKey = (projectId: string, data: ApiKeyCreate) =>
  apiFetch<ApiKey>(`/projects/${projectId}/api-keys`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteApiKey = (keyId: string) =>
  apiFetch(`/projects/api-keys/${keyId}`, {
    method: "DELETE",
  });

export const getExternalExportUrl = (projectId: string, _key: string, format: string) => {
  const base = window.location.origin;
  return `${base}${API_BASE_URL}/projects/external/export?project_id=${projectId}&format=${format}`;
};

// --- Organizations ---

export const getCurrentOrg = (): Promise<Organization> => apiFetch("/orgs/current");

export const listOrgMembers = (): Promise<Member[]> => apiFetch("/orgs/members");

export const inviteOrgMember = (email: string) =>
  apiFetch("/orgs/members/invite", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const updateOrgMember = (member_id: string, status: string) =>
  apiFetch(`/orgs/members/${member_id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const removeOrgMember = (memberId: string) =>
  apiFetch(`/orgs/members/${memberId}`, {
    method: "DELETE",
  });

export const listOrgInvitations = (): Promise<Invitation[]> => apiFetch("/orgs/invitations");

export const resendOrgInvitation = (invitationId: string) =>
  apiFetch(`/orgs/invitations/${invitationId}/resend`, {
    method: "POST",
  });

export const revokeOrgInvitation = (invitationId: string) =>
  apiFetch(`/orgs/invitations/${invitationId}`, {
    method: "DELETE",
  });

// --- Users ---

export const getMe = () => apiFetch<Member>("/users/me");

export const listUserSessions = () => apiFetch("/users/me/sessions");

export const revokeUserSession = (sessionId: string) =>
  apiFetch(`/users/me/sessions/${sessionId}`, {
    method: "DELETE",
  });

export const requestUserPasswordReset = () =>
  apiFetch("/users/me/password-reset", {
    method: "POST",
  });

// --- Sources ---

export const listSources = (projectId: string) => apiFetch<Source[]>(`/projects/${projectId}/sources`);

export const createSource = (projectId: string, data: SourceCreate) =>
  apiFetch<Source>(`/projects/${projectId}/sources`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateSource = (sourceId: string, data: SourceUpdate) =>
  apiFetch<Source>(`/sources/${sourceId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteSource = (sourceId: string) =>
  apiFetch(`/sources/${sourceId}`, {
    method: "DELETE",
  });

// --- Articles ---

export const getArticle = (id: string) => apiFetch<Article>(`/articles/${id}`);

export const processArticle = (id: string) =>
  apiFetch<Article>(`/articles/${id}/process`, {
    method: "POST",
  });

export const updateArticleAnnotations = (id: string, annotations: Annotation[]) =>
  apiFetch<Article>(`/articles/${id}/annotations`, {
    method: "PATCH",
    body: JSON.stringify({ annotations }),
  });

export const updateArticle = (id: string, data: ArticleUpdate) =>
  apiFetch<Article>(`/articles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteArticle = (id: string) =>
  apiFetch(`/articles/${id}`, {
    method: "DELETE",
  });

// --- Templates ---

export const listTemplates = () => apiFetch<ProjectTemplate[]>("/templates");

export const getTemplate = (id: string) => apiFetch<ProjectTemplate>(`/templates/${id}`);

export const createTemplate = (data: ProjectTemplateCreate) =>
  apiFetch<ProjectTemplate>("/templates", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateTemplate = (id: string, data: ProjectTemplateUpdate) =>
  apiFetch<ProjectTemplate>(`/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteTemplate = (id: string) =>
  apiFetch(`/templates/${id}`, {
    method: "DELETE",
  });

// Backwards compatibility shim (optional, but good for migration)
export const projectsApi = {
  list: listProjects,
  get: getProject,
  create: createProject,
  update: updateProject,
  delete: deleteProject,
  listArticles: listProjectArticles,
  listArticlesWithLocations: listProjectArticlesWithLocations,
  bulkDeleteArticles: bulkDeleteArticles,
  bulkReprocessArticles: bulkReprocessArticles,
  bulkMarkArticlesReviewed: bulkMarkArticlesReviewed,
  importUrls: importUrls,
  discoverArticles: discoverArticles,
  reprocess: reprocessProject,
  getStats: getProjectStats,
  getExportToken: getExportToken,
  exportJsonUrl: getExportJsonUrl,
  exportCsvUrl: getExportCsvUrl,
  exportReportUrl: getExportReportUrl,
  getReportPreview: getReportPreview,
  listAdapters: listModelAdapters,
  trainAdapter: trainModelAdapter,
  activateAdapter: activateModelAdapter,
  deactivateAdapter: deactivateModelAdapter,
  listApiKeys: listApiKeys,
  createApiKey: createApiKey,
  deleteApiKey: deleteApiKey,
  externalExportUrl: getExternalExportUrl,
};

export const orgsApi = {
  getCurrent: getCurrentOrg,
  listMembers: listOrgMembers,
  inviteMember: inviteOrgMember,
  updateMember: updateOrgMember,
  removeMember: removeOrgMember,
  listInvitations: listOrgInvitations,
  resendInvitation: resendOrgInvitation,
  revokeInvitation: revokeOrgInvitation,
};

export const usersApi = {
  getMe: getMe,
  listSessions: listUserSessions,
  revokeSession: revokeUserSession,
  requestPasswordReset: requestUserPasswordReset,
};

export const sourcesApi = {
  list: listSources,
  create: createSource,
  update: updateSource,
  delete: deleteSource,
};

export const articlesApi = {
  get: getArticle,
  process: processArticle,
  updateAnnotations: updateArticleAnnotations,
  update: updateArticle,
  delete: deleteArticle,
};

export const templatesApi = {
  list: listTemplates,
  get: getTemplate,
  create: createTemplate,
  update: updateTemplate,
  delete: deleteTemplate,
};
