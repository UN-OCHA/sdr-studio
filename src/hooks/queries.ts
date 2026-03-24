import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import type { 
  ProjectUpdate, 
  SourceCreate, 
  SourceUpdate, 
  ArticleUpdate, 
  Article, 
  ArticleListResponse,
  ProjectStats,
  ProjectTemplateUpdate,
  ApiKeyCreate,
  ModelAdapter,
  TrainingRequest,
  Annotation
} from "../types";

// --- Projects ---

export const useProjects = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
    enabled,
  });
};

export const useProject = (id: string | null) => {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createProject,
    meta: {
      successMessage: "Project created successfully",
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectUpdate }) => 
      api.updateProject(id, data),
    meta: {
      successMessage: "Project updated successfully",
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", project.id] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteProject,
    meta: {
      successMessage: "Project deleted",
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};

// --- Articles ---

export const useArticles = (projectId: string, params: {
  search?: string;
  status?: string;
  source_type?: string;
  skip?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}) => {
  return useQuery({
    queryKey: ["articles", projectId, params],
    queryFn: () => api.listProjectArticles(projectId, params),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const data = query.state.data as ArticleListResponse | undefined;
      const isProcessing = data?.articles.some(
        (a) => a.status === "processing" || a.status === "pending"
      );
      return isProcessing ? 3000 : false;
    },
  });
};

export const useArticlesWithLocations = (projectId: string) => {
  return useQuery({
    queryKey: ["articles", projectId, "locations"],
    queryFn: () => api.listProjectArticlesWithLocations(projectId),
    enabled: !!projectId,
  });
};

export const useArticle = (articleId: string | null) => {
  return useQuery({
    queryKey: ["articles", articleId],
    queryFn: () => api.getArticle(articleId!),
    enabled: !!articleId,
    refetchInterval: (query) => {
      const article = query.state.data as Article | undefined;
      return article?.status === "processing" || article?.status === "pending"
        ? 3000
        : false;
    },
  });
};

export const useUpdateArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ArticleUpdate }) =>
      api.updateArticle(id, data),
    onSuccess: (article) => {
      queryClient.invalidateQueries({ queryKey: ["articles", article.project_id] });
      queryClient.invalidateQueries({ queryKey: ["articles", article.id] });
    },
  });
};

export const useUpdateAnnotations = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, annotations }: { id: string; annotations: Annotation[] }) =>
      api.updateArticleAnnotations(id, annotations),
    onSuccess: (article) => {
      queryClient.invalidateQueries({ queryKey: ["articles", article.id] });
    },
  });
};

export const useDeleteArticle = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
    },
  });
};

export const useBulkDeleteArticles = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (articleIds: string[]) => api.bulkDeleteArticles(projectId, articleIds),
    meta: {
      successMessage: "Selected articles deleted",
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
    },
  });
};

export const useBulkReprocessArticles = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (articleIds: string[]) => api.bulkReprocessArticles(projectId, articleIds),
    meta: {
      successMessage: "Articles queued for reprocessing",
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
    },
  });
};

export const useBulkMarkArticlesReviewed = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ articleIds, reviewed }: { articleIds: string[]; reviewed: boolean }) =>
      api.bulkMarkArticlesReviewed(projectId, articleIds, reviewed),
    meta: {
      successMessage: "Articles updated",
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
    },
  });
};

export const useImportUrls = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (urls: string[]) => api.importUrls(projectId, urls),
    meta: {
      successMessage: "URLs imported successfully",
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
    },
  });
};

export const useDiscoverArticles = (projectId: string) => {
  return useMutation({
    mutationFn: (data: { type: string; url: string; config?: Record<string, unknown> }) =>
      api.discoverArticles(projectId, data),
    meta: {
      successMessage: "Discovery task started",
    },
  });
};

export const useExportToken = () => {
  return useMutation({
    mutationFn: api.getExportToken,
  });
};

export const useReportPreview = (projectId: string) => {
  return useMutation({
    mutationFn: (config: Record<string, unknown>) => 
      api.getReportPreview(projectId, config),
  });
};

export const useReprocessProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.reprocessProject(projectId),
    meta: {
      successMessage: "All articles queued for reprocessing",
    },
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["articles", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
    },
  });
};

export const useProcessArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (articleId: string) => api.processArticle(articleId),
    meta: {
      successMessage: "Article reprocessing started",
    },
    onSuccess: (article) => {
      queryClient.invalidateQueries({ queryKey: ["articles", article.id] });
      queryClient.invalidateQueries({ queryKey: ["project-stats", article.project_id] });
      queryClient.invalidateQueries({ queryKey: ["articles", article.project_id] });
    },
  });
};

// --- Sources ---

export const useSources = (projectId: string) => {
  return useQuery({
    queryKey: ["sources", projectId],
    queryFn: () => api.listSources(projectId),
    enabled: !!projectId,
  });
};

export const useCreateSource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: SourceCreate }) =>
      api.createSource(projectId, data),
    onSuccess: (source) => {
      queryClient.invalidateQueries({ queryKey: ["sources", source.project_id] });
    },
  });
};

export const useUpdateSource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SourceUpdate }) =>
      api.updateSource(id, data),
    onSuccess: (source) => {
      queryClient.invalidateQueries({ queryKey: ["sources", source.project_id] });
    },
  });
};

export const useDeleteSource = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", projectId] });
    },
  });
};

// --- Stats ---

export const useProjectStats = (projectId: string) => {
return useQuery({
  queryKey: ["project-stats", projectId],
  queryFn: () => api.getProjectStats(projectId),
  enabled: !!projectId,
  refetchInterval: (query) => {
    const stats = query.state.data as ProjectStats | undefined;
    const isProcessing = (stats?.processing || 0) > 0 || (stats?.pending || 0) > 0;
    return isProcessing ? 3000 : false;
  },
});
};

export const useProjectUsage = (projectId: string) => {
return useQuery({
  queryKey: ["project-usage", projectId],
  queryFn: () => api.getProjectUsage(projectId),
  enabled: !!projectId,
});
};


// --- Templates ---

export const useTemplates = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["templates"],
    queryFn: api.listTemplates,
    enabled,
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
};

export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectTemplateUpdate }) =>
      api.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
};

// --- Organization ---

export const useCurrentOrg = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["org", "current"],
    queryFn: api.getCurrentOrg,
    enabled,
  });
};

export const useOrgMembers = () => {
  return useQuery({
    queryKey: ["org", "members"],
    queryFn: api.listOrgMembers,
  });
};

export const useOrgInvitations = () => {
  return useQuery({
    queryKey: ["org", "invitations"],
    queryFn: api.listOrgInvitations,
  });
};

export const useInviteMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.inviteOrgMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "invitations"] });
    },
  });
};

export const useUpdateMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateOrgMember(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "members"] });
    },
  });
};

export const useRemoveMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.removeOrgMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "members"] });
    },
  });
};

export const useResendInvitation = () => {
  return useMutation({
    mutationFn: api.resendOrgInvitation,
  });
};

export const useRevokeInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.revokeOrgInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "invitations"] });
    },
  });
};

// --- User ---

export const useUserProfile = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["user", "profile"],
    queryFn: api.getMe,
    enabled,
  });
};

export const useUserSessions = () => {
  return useQuery({
    queryKey: ["user", "sessions"],
    queryFn: api.listUserSessions,
  });
};

export const useRevokeSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.revokeUserSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "sessions"] });
    },
  });
};

export const useRequestPasswordReset = () => {
  return useMutation({
    mutationFn: api.requestUserPasswordReset,
  });
};

// --- API Keys ---

export const useApiKeys = (projectId: string) => {
  return useQuery({
    queryKey: ["api-keys", projectId],
    queryFn: () => api.listApiKeys(projectId),
    enabled: !!projectId,
  });
};

export const useCreateApiKey = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ApiKeyCreate) => api.createApiKey(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", projectId] });
    },
  });
};

export const useDeleteApiKey = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", projectId] });
    },
  });
};

// --- Adapters ---

export const useAdapters = (projectId: string) => {
  return useQuery({
    queryKey: ["adapters", projectId],
    queryFn: () => api.listModelAdapters(projectId),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const adapters = query.state.data as ModelAdapter[] | undefined;
      return adapters?.some((a) => a.status === "training") ? 3000 : false;
    },
  });
};

export const useTrainAdapter = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TrainingRequest) => api.trainModelAdapter(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adapters", projectId] });
    },
  });
};

export const useActivateAdapter = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (adapterId: string) => api.activateModelAdapter(projectId, adapterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["adapters", projectId] });
    },
  });
};

export const useDeactivateAdapter = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.deactivateModelAdapter(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["adapters", projectId] });
    },
  });
};
