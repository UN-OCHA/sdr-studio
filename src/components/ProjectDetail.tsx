import {
  Button,
  Dialog,
  Intent,
  NonIdealState,
  TextArea,
} from "@blueprintjs/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { articlesApi, projectsApi } from "../api";
import { useLocalStorage } from "../hooks/useStorage";
import { useToaster } from "../hooks/useToaster";
import type { Article, Project, ProjectStats, SettingsSection } from "../types";
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

type ProjectDetailProps = {
  project: Project;
  onImportUrls: (urls: string[]) => void;
  onUpdateProject: (project: Project) => void;
  onBack: () => void;
};

export function ProjectDetail({
  project,
  onImportUrls,
  onUpdateProject,
  onBack,
}: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<
    "home" | "articles" | "settings" | "coverage"
  >("home");
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("profile");

  // Articles state
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

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

  // Filter/Sort/Pagination state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [skip, setSkip] = useState(0);
  const LIMIT = 50;

  const { toaster } = useToaster();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isFeedImportDialogOpen, setIsFeedImportDialogOpen] = useState(false);
  const [urlsToImport, setUrlsToImport] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState<ProjectStats | null>(null);
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

  const fetchArticles = useCallback(
    async (isLoadMore = false) => {
      try {
        setIsLoading(true);
        const currentSkip = isLoadMore ? skip + LIMIT : 0;
        const data = await projectsApi.listArticles(project.id, {
          search,
          status: statusFilter,
          skip: currentSkip,
          limit: LIMIT,
          sort_by: sortBy,
          sort_order: sortOrder,
        });

        if (isLoadMore) {
          setArticles((prev) => [...prev, ...data.articles]);
        } else {
          setArticles(data.articles);
          if (data.articles.length > 0 && !selectedArticleId) {
            setSelectedArticleId(data.articles[0].id);
          }
        }
        setTotalCount(data.total);
        setSkip(currentSkip);
      } catch (err) {
        console.error("Failed to fetch articles:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [
      project.id,
      search,
      statusFilter,
      sortBy,
      sortOrder,
      skip,
      selectedArticleId,
    ],
  );

  // Initial fetch and on filter changes
  useEffect(() => {
    void fetchArticles(false);
  }, [fetchArticles, search, statusFilter, sortBy, sortOrder]);

  // Keyboard navigation for articles
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (activeTab !== "articles" || articles.length === 0) return;

      const currentIndex = articles.findIndex((a) => a.id === selectedArticleId);

      if (e.key === "ArrowLeft") {
        if (currentIndex > 0) {
          setSelectedArticleId(articles[currentIndex - 1].id);
        }
      } else if (e.key === "ArrowRight") {
        if (currentIndex < articles.length - 1) {
          setSelectedArticleId(articles[currentIndex + 1].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, articles, selectedArticleId]);

  // Poll for stats if there are items processing
  useEffect(() => {
    let interval: number | undefined;
    let wasProcessing = false;

    const fetchStats = async () => {
      try {
        const data = await projectsApi.getStats(project.id);
        setStats(data);

        const isStillProcessing = data.pending > 0 || data.processing > 0;

        if (wasProcessing && !isStillProcessing) {
          void fetchArticles(false);
        }

        wasProcessing = isStillProcessing;

        if (!isStillProcessing) {
          if (interval) window.clearInterval(interval);
        }
      } catch (err) {
        console.error("Failed to fetch project stats:", err);
      }
    };

    void fetchStats().then(() => {
      if (wasProcessing) {
        interval = window.setInterval(fetchStats, 3000);
      }
    });

    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [project.id, fetchArticles]);

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
          onImport={async (urls) => onImportUrls(urls)}
        />
      </div>
    );
  }

  const selectedArticle = articles.find((a) => a.id === selectedArticleId);

  const handleImport = () => {
    const urls = urlsToImport
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u !== "");
    if (urls.length > 0) {
      onImportUrls(urls);
      toaster?.show({
        message: `Importing ${urls.length} URLs in the background...`,
        intent: Intent.PRIMARY,
        icon: "cloud-upload",
      });
      setIsImportDialogOpen(false);
      setUrlsToImport("");
    }
  };

  const handleSaveConfig = async (
    newConfig: Project["extraction_config"],
    newExportConfig?: Project["export_config"],
  ) => {
    try {
      setIsSaving(true);
      const updated = await projectsApi.update(project.id, {
        extraction_config: newConfig,
        export_config: newExportConfig,
      });
      onUpdateProject(updated);
      setPendingConfig(null);
      setPendingExportConfig(null);
      toaster?.show({
        message: "Project configuration updated successfully",
        intent: Intent.SUCCESS,
        icon: "tick",
      });
    } catch (err) {
      console.error("Failed to save configuration:", err);
      toaster?.show({
        message: "Failed to update project configuration",
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
      const updated = await projectsApi.update(project.id, updates);
      onUpdateProject(updated);
      toaster?.show({
        message: "Project details saved",
        intent: Intent.SUCCESS,
        icon: "tick",
      });
    } catch (err) {
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
      await projectsApi.reprocess(project.id);
      toaster?.show({
        message: "Reprocessing all articles...",
        intent: Intent.PRIMARY,
        icon: "automatic-updates",
      });
      void fetchArticles(false);
    } catch (err) {
      console.error("Failed to reprocess articles:", err);
    }
  };

  const handleRetryArticle = async (articleId: string) => {
    try {
      await articlesApi.process(articleId);
      void fetchArticles(false);
    } catch (err) {
      console.error("Failed to retry article:", err);
    }
  };

  const handleBulkDelete = async () => {
    if (checkedArticleIds.size === 0) return;
    if (!confirm(`Delete ${checkedArticleIds.size} selected articles?`)) return;

    try {
      await projectsApi.bulkDeleteArticles(
        project.id,
        Array.from(checkedArticleIds),
      );
      toaster?.show({
        message: `Deleted ${checkedArticleIds.size} articles`,
        intent: Intent.SUCCESS,
        icon: "trash",
      });
      setCheckedArticleIds(new Set());
      void fetchArticles(false);
    } catch (err) {
      console.error("Failed to delete articles:", err);
    }
  };

  const entityLabels = Object.keys(project.extraction_config?.entities || {});

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ProjectHomeHeader
        project={project}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        articlesCount={articles.length}
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
              <div className="grow overflow-y-clip">
                {activeTab === "articles" ? (
                  <ArticleSidebar
                    project={project}
                    articles={articlesWithPinned}
                    totalCount={totalCount}
                    stats={stats}
                    isLoading={isLoading}
                    selectedArticleId={selectedArticleId}
                    checkedArticleIds={checkedArticleIds}
                    search={search}
                    statusFilter={statusFilter}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSearchChange={setSearch}
                    onStatusFilterChange={setStatusFilter}
                    onSortByChange={setSortBy}
                    onSortOrderToggle={() =>
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                    }
                    onArticleSelect={setSelectedArticleId}
                    onToggleCheck={handleToggleCheck}
                    onToggleCheckAll={handleToggleCheckAll}
                    onBulkDelete={handleBulkDelete}
                    onRefresh={() => void fetchArticles(false)}
                    onReprocessAll={handleReprocessAll}
                    onRetryArticle={handleRetryArticle}
                    onLoadMore={() => void fetchArticles(true)}
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
                  } else {
                    setActiveTab(_tab as any);
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
                    setArticles((prev) =>
                      prev.map((a) => (a.id === updated.id ? updated : a)),
                    );
                  }}
                  onRefresh={() => void fetchArticles(false)}
                  onDelete={() => {
                    setSelectedArticleId(null);
                    void fetchArticles(false);
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
                stats={stats}
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
              onClick={handleImport}
            />
          </div>
        </div>
      </Dialog>

      <ImportFeedDialog
        project={project}
        isOpen={isFeedImportDialogOpen}
        onClose={() => setIsFeedImportDialogOpen(false)}
        onRefresh={() => void fetchArticles(false)}
      />
    </div>
  );
}
