import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, sourcesApi, articlesApi, templatesApi, orgsApi, usersApi } from "../api";
import type { 
  Project, 
  ProjectCreate, 
  ProjectUpdate, 
  Source, 
  SourceCreate, 
  SourceUpdate, 
  ArticleUpdate, 
  Article, 
  ArticleListResponse,
  ProjectStats,
  ProjectTemplate,
  ProjectTemplateCreate,
  ProjectTemplateUpdate,
  Member,
  Invitation,
  Organization,
  ApiKey,
  ApiKeyCreate,
  ModelAdapter,
  TrainingRequest,
  Annotation
} from "../types";

// --- Projects ---

export const useProjects = () => {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list() as Promise<Project[]>,
  });
};

export const useProject = (id: string | null) => {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => projectsApi.get(id!) as Promise<Project>,
    enabled: !!id,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectCreate) => projectsApi.create(data) as Promise<Project>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectUpdate }) => 
      projectsApi.update(id, data) as Promise<Project>,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", project.id] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
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
    queryFn: () => projectsApi.listArticles(projectId, params) as Promise<ArticleListResponse>,
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
    queryFn: () => projectsApi.listArticlesWithLocations(projectId) as Promise<Article[]>,
    enabled: !!projectId,
  });
};

export const useArticle = (articleId: string | null) => {
  return useQuery({
    queryKey: ["articles", articleId],
    queryFn: () => articlesApi.get(articleId!) as Promise<Article>,
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
      articlesApi.update(id, data) as Promise<Article>,
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
      articlesApi.updateAnnotations(id, annotations) as Promise<Article>,
    onSuccess: (article) => {
      queryClient.invalidateQueries({ queryKey: ["articles", article.id] });
    },
  });
};

export const useDeleteArticle = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => articlesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
    },
  });
};

export const useBulkDeleteArticles = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (articleIds: string[]) => projectsApi.bulkDeleteArticles(projectId, articleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
    },
  });
};

export const useImportUrls = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (urls: string[]) => projectsApi.importUrls(projectId, urls),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
    },
  });
};

export const useDiscoverArticles = (projectId: string) => {
  return useMutation({
    mutationFn: (data: { type: string; url: string; config?: Record<string, unknown> }) =>
      projectsApi.discoverArticles(projectId, data),
  });
};

export const useExportToken = () => {
  return useMutation({
    mutationFn: () => projectsApi.getExportToken() as Promise<{ token: string }>,
  });
};

export const useReportPreview = (projectId: string) => {
  return useMutation({
    mutationFn: (config: Record<string, unknown>) => 
      projectsApi.getReportPreview(projectId, config),
  });
};

export const useReprocessProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projectsApi.reprocess(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["articles", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-stats", projectId] });
    },
  });
};

export const useProcessArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (articleId: string) => articlesApi.process(articleId) as Promise<Article>,
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
    queryFn: () => sourcesApi.list(projectId) as Promise<Source[]>,
    enabled: !!projectId,
  });
};

export const useCreateSource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: SourceCreate }) =>
      sourcesApi.create(projectId, data) as Promise<Source>,
    onSuccess: (source) => {
      queryClient.invalidateQueries({ queryKey: ["sources", source.project_id] });
    },
  });
};

export const useUpdateSource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SourceUpdate }) =>
      sourcesApi.update(id, data) as Promise<Source>,
    onSuccess: (source) => {
      queryClient.invalidateQueries({ queryKey: ["sources", source.project_id] });
    },
  });
};

export const useDeleteSource = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sourcesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", projectId] });
    },
  });
};

// --- Stats ---

export const useProjectStats = (projectId: string) => {
  return useQuery({
    queryKey: ["project-stats", projectId],
    queryFn: () => projectsApi.getStats(projectId) as Promise<ProjectStats>,
    enabled: !!projectId,
    refetchInterval: (query) => {
      const stats = query.state.data as ProjectStats | undefined;
      const isProcessing = (stats?.processing || 0) > 0 || (stats?.pending || 0) > 0;
      return isProcessing ? 3000 : false;
    },
  });
};

// --- Templates ---

export const useTemplates = () => {
  return useQuery({
    queryKey: ["templates"],
    queryFn: () => templatesApi.list() as Promise<ProjectTemplate[]>,
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectTemplateCreate) => templatesApi.create(data) as Promise<ProjectTemplate>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
};

export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectTemplateUpdate }) =>
      templatesApi.update(id, data) as Promise<ProjectTemplate>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
};

// --- Organization ---

export const useCurrentOrg = () => {
  return useQuery({
    queryKey: ["org", "current"],
    queryFn: () => orgsApi.getCurrent() as Promise<Organization>,
  });
};

export const useOrgMembers = () => {
  return useQuery({
    queryKey: ["org", "members"],
    queryFn: () => orgsApi.listMembers() as Promise<Member[]>,
  });
};

export const useOrgInvitations = () => {
  return useQuery({
    queryKey: ["org", "invitations"],
    queryFn: () => orgsApi.listInvitations() as Promise<Invitation[]>,
  });
};

export const useInviteMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => orgsApi.inviteMember(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "invitations"] });
    },
  });
};

export const useUpdateMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => orgsApi.updateMember(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "members"] });
    },
  });
};

export const useRemoveMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orgsApi.removeMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "members"] });
    },
  });
};

export const useResendInvitation = () => {
  return useMutation({
    mutationFn: (id: string) => orgsApi.resendInvitation(id),
  });
};

export const useRevokeInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orgsApi.revokeInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "invitations"] });
    },
  });
};

// --- User ---

export const useUserProfile = () => {
  return useQuery({
    queryKey: ["user", "profile"],
    queryFn: () => usersApi.getMe() as Promise<Member>,
  });
};

export const useUserSessions = () => {
  return useQuery({
    queryKey: ["user", "sessions"],
    queryFn: () => usersApi.listSessions(),
  });
};

export const useRevokeSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "sessions"] });
    },
  });
};

export const useRequestPasswordReset = () => {
  return useMutation({
    mutationFn: () => usersApi.requestPasswordReset(),
  });
};

// --- API Keys ---

export const useApiKeys = (projectId: string) => {
  return useQuery({
    queryKey: ["api-keys", projectId],
    queryFn: () => projectsApi.listApiKeys(projectId) as Promise<ApiKey[]>,
    enabled: !!projectId,
  });
};

export const useCreateApiKey = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ApiKeyCreate) => projectsApi.createApiKey(projectId, data) as Promise<ApiKey>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", projectId] });
    },
  });
};

export const useDeleteApiKey = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", projectId] });
    },
  });
};

// --- Adapters ---

export const useAdapters = (projectId: string) => {
  return useQuery({
    queryKey: ["adapters", projectId],
    queryFn: () => projectsApi.listAdapters(projectId) as Promise<ModelAdapter[]>,
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
    mutationFn: (data: TrainingRequest) => projectsApi.trainAdapter(projectId, data) as Promise<ModelAdapter>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adapters", projectId] });
    },
  });
};

export const useActivateAdapter = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (adapterId: string) => projectsApi.activateAdapter(projectId, adapterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["adapters", projectId] });
    },
  });
};

export const useDeactivateAdapter = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectsApi.deactivateAdapter(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["adapters", projectId] });
    },
  });
};
