import {
  Button,
  Dialog,
  Intent,
  NonIdealState,
  TextArea,
} from "@blueprintjs/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useLocalStorage } from "../hooks/useStorage";
import { useToaster } from "../hooks/useToaster";
import type { Article, ArticleListResponse, Project, SettingsSection } from "../types";
import { ArticleView } from "./ArticleView";
import { CoverageView } from "./CoverageView";
import { ProjectHome } from "./ProjectHome";
import { ProjectOnboarding } from "./ProjectOnboarding";
import { ArticleSidebar } from "./project-detail/ArticleSidebar";
import { ImportFeedDialog } from "./project-detail/ImportFeedDialog";
import { ProjectHomeHeader } from "./project-detail/ProjectHomeHeader";
import { SettingsContent } from "./project-detail/SettingsContent";
import { SettingsSidebar } from "./project-detail/SettingsSidebar";
import { SidebarExportDock } from "./project-detail/SidebarExportDock";
import { 
  useArticles, 
  useProjectStats, 
  useUpdateProject, 
  useImportUrls, 
  useReprocessProject, 
  useProcessArticle, 
  useBulkDeleteArticles 
} from "../hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { ensureError } from "../utils/errorUtils";

type ProjectDetailProps = {
  project: Project;
  onUpdateProject: (project: Project) => void;
  onBack: () => void;
};

export function ProjectDetail({
  project,
  onUpdateProject,
  onBack,
}: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<
    "home" | "articles" | "settings" | "coverage"
  >("home");
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("profile");

  const queryClient = useQueryClient();
  const { toaster } = useToaster();

  // Selection state
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    null,
  );
  const [checkedArticleIds, setCheckedArticleIds] = useState<Set<string>>(
    new Set(),
  );

  // Pin state (persistent per project)
  const [pinnedIds, setPinnedIds] = useLocalStorage<string[]>(
    `pinned_articles_${project.id}`,
    [],
  );

  // Filter/Sort/Pagination state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // Reset page when filters or sort change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sourceFilter, sortBy, sortOrder]);

  const articleParams = useMemo(() => ({
    search,
    status: statusFilter,
    source_type: sourceFilter,
    skip: (page - 1) * LIMIT,
    limit: LIMIT,
    sort_by: sortBy,
    sort_order: sortOrder,
  }), [search, statusFilter, sourceFilter, page, sortBy, sortOrder]);

  const { data: articleData, isLoading: isLoadingArticles, refetch: refetchArticles } = useArticles(project.id, articleParams);
  const { data: stats } = useProjectStats(project.id);
  const updateProjectMutation = useUpdateProject();
  const importUrlsMutation = useImportUrls(project.id);
  const reprocessProjectMutation = useReprocessProject();
  const processArticleMutation = useProcessArticle();
  const bulkDeleteArticlesMutation = useBulkDeleteArticles(project.id);

  const articles = useMemo(() => articleData?.articles || [], [articleData?.articles]);
  const totalCount = articleData?.total || 0;

  const handleTogglePin = useCallback((article: Article) => {
    setPinnedIds((prev) => {
      if (prev.includes(article.id)) {
        return prev.filter((id) => id !== article.id);
      } else {
        return [...prev, article.id];
      }
    });
  }, [setPinnedIds]);

  const handleClearPinned = () => {
    setPinnedIds([]);
  };

  const pinnedArticles = useMemo(() => {
    return articles
      .filter((a) => pinnedIds.includes(a.id))
      .sort(
        (a, b) => pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id),
      );
  }, [articles, pinnedIds]);

  // Enhanced articles with pinned status
  const articlesWithPinned = useMemo(() => {
    return articles.map((a) => ({
      ...a,
      pinned: pinnedIds.includes(a.id),
    }));
  }, [articles, pinnedIds]);

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isFeedImportDialogOpen, setIsFeedImportDialogOpen] = useState(false);
  const [urlsToImport, setUrlsToImport] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingProjectUpdates, setPendingProjectUpdates] = useState<
    Partial<Project>
  >({});
  const [pendingConfig, setPendingConfig] = useState<
    Project["extraction_config"] | null
  >(null);
  const [pendingExportConfig, setPendingExportConfig] = useState<
    Project["export_config"] | null
  >(null);

  useEffect(() => {
    setPendingConfig(null);
    setPendingExportConfig(null);
    setPendingProjectUpdates({});
  }, [project.id]);

  useEffect(() => {
    if (articles.length > 0 && !selectedArticleId) {
      setSelectedArticleId(articles[0].id);
    }
  }, [articles, selectedArticleId]);

  // No-op: manual polling removed in favor of hook-level refetchIntervals

  const handleToggleCheck = useCallback((id: string) => {
    setCheckedArticleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleCheckAll = useCallback(() => {
    setCheckedArticleIds((prev) => {
      if (prev.size === articles.length) {
        return new Set();
      } else {
        return new Set(articles.map((a) => a.id));
      }
    });
  }, [articles]);

  // If onboarding is not completed, show the onboarding view
  if (!project.onboarding_completed) {
    return (
      <div className="h-full overflow-y-auto bg-gray-50 dark:bg-bp-dark-surface">
        <ProjectOnboarding
          project={project}
          onComplete={onUpdateProject}
          onImport={async (urls) => {
            await importUrlsMutation.mutateAsync(urls);
          }}
        />
      </div>
    );
  }

  const selectedArticle = articles.find((a) => a.id === selectedArticleId);

  const handleImport = async () => {
    const urls = urlsToImport
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u !== "");
    if (urls.length > 0) {
      try {
        await importUrlsMutation.mutateAsync(urls);
        toaster?.show({
          message: `Importing ${urls.length} URLs in the background...`,
          intent: Intent.PRIMARY,
          icon: "cloud-upload",
        });
        setIsImportDialogOpen(false);
        setUrlsToImport("");
      } catch (err: unknown) {
        toaster?.show({
          message: ensureError(err).message || "Import failed",
          intent: Intent.DANGER,
        });
      }
    }
  };

  const handleSaveConfig = async (
    newConfig: Project["extraction_config"],
    newExportConfig?: Project["export_config"],
  ) => {
    try {
      setIsSaving(true);
      const updated = await updateProjectMutation.mutateAsync({
        id: project.id,
        data: {
          extraction_config: newConfig,
          export_config: newExportConfig,
        },
      });
      onUpdateProject(updated);
      setPendingConfig(null);
      setPendingExportConfig(null);
      toaster?.show({
        message: "Project configuration updated successfully",
        intent: Intent.SUCCESS,
        icon: "tick",
      });
    } catch (err: unknown) {
      console.error("Failed to save configuration:", err);
      toaster?.show({
        message: ensureError(err).message || "Failed to update project configuration",
        intent: Intent.DANGER,
        icon: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProjectDetails = async (updates: Partial<Project>) => {
    try {
      setIsSaving(true);
      const updated = await updateProjectMutation.mutateAsync({
        id: project.id,
        data: updates,
      });
      onUpdateProject(updated);
      toaster?.show({
        message: "Project details saved",
        intent: Intent.SUCCESS,
        icon: "tick",
      });
    } catch (err: unknown) {
      console.error("Failed to update project details:", err);
      toaster?.show({
        message: "Failed to save project details",
        intent: Intent.DANGER,
        icon: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReprocessAll = async () => {
    try {
      await reprocessProjectMutation.mutateAsync(project.id);
      toaster?.show({
        message: "Reprocessing all articles...",
        intent: Intent.PRIMARY,
        icon: "automatic-updates",
      });
    } catch (err: unknown) {
      console.error("Failed to reprocess articles:", err);
      toaster?.show({
        message: ensureError(err).message || "Reprocess failed",
        intent: Intent.DANGER,
      });
    }
  };

  const handleRetryArticle = async (articleId: string) => {
    try {
      await processArticleMutation.mutateAsync(articleId);
      toaster?.show({
        message: "Retrying article processing...",
        intent: Intent.PRIMARY,
      });
    } catch (err: unknown) {
      console.error("Failed to retry article:", err);
      toaster?.show({
        message: ensureError(err).message || "Retry failed",
        intent: Intent.DANGER,
      });
    }
  };

  const handleBulkDelete = async () => {
    if (checkedArticleIds.size === 0) return;
    if (!confirm(`Delete ${checkedArticleIds.size} selected articles?`)) return;

    try {
      await bulkDeleteArticlesMutation.mutateAsync(Array.from(checkedArticleIds));
      toaster?.show({
        message: `Deleted ${checkedArticleIds.size} articles`,
        intent: Intent.SUCCESS,
        icon: "trash",
      });
      setCheckedArticleIds(new Set());
    } catch (err: unknown) {
      console.error("Failed to delete articles:", err);
      toaster?.show({
        message: ensureError(err).message || "Deletion failed",
        intent: Intent.DANGER,
      });
    }
  };

  const entityLabels = Object.keys(project.extraction_config?.entities || {});

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ProjectHomeHeader
        project={project}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        articlesCount={totalCount}
        onBack={onBack}
      />

      <PanelGroup
        key={
          activeTab === "home" || activeTab === "coverage"
            ? "no-sidebar"
            : "with-sidebar"
        }
        direction="horizontal"
        className="grow overflow-hidden"
      >
        {activeTab !== "home" && activeTab !== "coverage" && (
          <>
            <Panel
              defaultSize={20}
              minSize={20}
              maxSize={50}
              className="flex flex-col bg-gray-50 dark:bg-bp-dark-surface border-r border-gray-200 dark:border-bp-dark-border min-w-64"
            >
              <div className="grow min-h-0 overflow-y-clip">
                {activeTab === "articles" ? (
                  <ArticleSidebar
                    project={project}
                    articles={articlesWithPinned}
                    totalCount={totalCount}
                    stats={stats || null}
                    isLoading={isLoadingArticles}
                    selectedArticleId={selectedArticleId}
                    checkedArticleIds={checkedArticleIds}
                    search={search}
                    statusFilter={statusFilter}
                    sourceFilter={sourceFilter}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSearchChange={setSearch}
                    onStatusFilterChange={setStatusFilter}
                    onSourceFilterChange={setSourceFilter}
                    onSortByChange={setSortBy}
                    onSortOrderToggle={() =>
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                    }
                    onArticleSelect={setSelectedArticleId}
                    onToggleCheck={handleToggleCheck}
                    onToggleCheckAll={handleToggleCheckAll}
                    onBulkDelete={handleBulkDelete}
                    onRefresh={() => void refetchArticles()}
                    onReprocessAll={handleReprocessAll}
                    onRetryArticle={handleRetryArticle}
                    page={page}
                    limit={LIMIT}
                    onPageChange={setPage}
                    onOpenUrlImportDialog={() => setIsImportDialogOpen(true)}
                    onOpenFeedImportDialog={() =>
                      setIsFeedImportDialogOpen(true)
                    }
                    pinnedArticles={pinnedArticles}
                    onTogglePin={handleTogglePin}
                    onClearPinned={handleClearPinned}
                  />
                ) : (
                  <SettingsSidebar
                    activeSection={settingsSection}
                    onChangeSection={setSettingsSection}
                  />
                )}
              </div>
              <SidebarExportDock project={project} />
            </Panel>
            <PanelResizeHandle className="w-1.5 bg-gray-100 dark:bg-bp-dark-header hover:bg-blue-200 transition-colors border-x border-gray-200 dark:border-bp-dark-border flex items-center justify-center group cursor-col-resize">
              <div className="w-0.5 h-8 bg-gray-300 group-hover:bg-blue-400 rounded-full" />
            </PanelResizeHandle>
          </>
        )}

        {/* Main Content */}
        <Panel className="bg-white dark:bg-bp-dark-bg flex flex-col overflow-hidden">
          <div className="grow overflow-y-auto min-h-0">
            {activeTab === "home" ? (
              <ProjectHome
                project={project}
                onTabChange={(_tab) => {
                  if (_tab === "monitoring") {
                    setActiveTab("settings");
                    setSettingsSection("monitoring");
                  } else if (_tab === "schema") {
                    setActiveTab("settings");
                    setSettingsSection("entities");
                  } else if (_tab === "profile") {
                    setActiveTab("settings");
                    setSettingsSection("profile");
                  } else if (_tab === "general") {
                    setActiveTab("settings");
                    setSettingsSection("general");
                  } else if (["home", "articles", "settings", "coverage"].includes(_tab)) {
                    setActiveTab(_tab as "home" | "articles" | "settings" | "coverage");
                  }
                }}
              />
            ) : activeTab === "articles" ? (
              selectedArticle ? (
                <ArticleView
                  article={{
                    ...selectedArticle,
                    pinned: pinnedIds.includes(selectedArticle.id),
                  }}
                  labels={entityLabels}
                  extractionConfig={project.extraction_config}
                  onUpdate={(updated) => {
                    queryClient.setQueryData(["articles", project.id, articleParams], (old: ArticleListResponse | undefined) => {
                      if (!old) return old;
                      return {
                        ...old,
                        articles: old.articles.map((a: Article) => a.id === updated.id ? updated : a)
                      };
                    });
                  }}
                  onRefresh={() => {
                    void queryClient.invalidateQueries({ queryKey: ["articles", project.id] });
                  }}
                  onDelete={() => {
                    setSelectedArticleId(null);
                  }}
                  onTogglePin={handleTogglePin}
                />
              ) : (
                <div className="p-12">
                  <NonIdealState
                    icon="document"
                    title="No Article Selected"
                    description="Select an article from the sidebar to view its content and extracted entities."
                    action={
                      articles.length === 0 &&
                      !search &&
                      statusFilter === "all" ? (
                        <Button
                          intent={Intent.PRIMARY}
                          text="Import URLs"
                          onClick={() => setIsImportDialogOpen(true)}
                        />
                      ) : undefined
                    }
                  />
                </div>
              )
            ) : activeTab === "coverage" ? (
              <div className="h-full overflow-hidden">
                <CoverageView project={project} />
              </div>
            ) : (
              <SettingsContent
                project={project}
                stats={stats || null}
                settingsSection={settingsSection}
                isSaving={isSaving}
                pendingConfig={pendingConfig}
                pendingExportConfig={pendingExportConfig}
                pendingProjectUpdates={pendingProjectUpdates}
                onSaveConfig={handleSaveConfig}
                onUpdateProjectDetails={handleUpdateProjectDetails}
                onProjectUpdate={onUpdateProject}
                onPendingConfigChange={setPendingConfig}
                onPendingExportConfigChange={setPendingExportConfig}
                onPendingProjectUpdatesChange={setPendingProjectUpdates}
              />
            )}
          </div>
        </Panel>
      </PanelGroup>

      <Dialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        title="Import Article URLs"
      >
        <div className="p-6">
          <p className="mb-4 text-gray-500 dark:text-gray-400">
            Paste a list of URLs pointing to web pages to scan (one per line).
          </p>
          <TextArea
            fill
            rows={10}
            placeholder="https://example.com/news/article1..."
            value={urlsToImport}
            onChange={(e) => setUrlsToImport(e.target.value)}
            className="font-mono text-sm"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button
              text="Cancel"
              onClick={() => setIsImportDialogOpen(false)}
            />
            <Button
              intent={Intent.PRIMARY}
              text={`Import ${urlsToImport.split("\n").filter((u) => u.trim() !== "").length} URLs`}
              loading={importUrlsMutation.isPending}
              onClick={handleImport}
            />
          </div>
        </div>
      </Dialog>

      <ImportFeedDialog
        project={project}
        isOpen={isFeedImportDialogOpen}
        onClose={() => setIsFeedImportDialogOpen(false)}
        onRefresh={() => {}}
      />
    </div>
  );
}
