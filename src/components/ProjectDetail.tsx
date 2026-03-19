import {
  Button,
  Dialog,
  Intent,
  NonIdealState,
  TextArea,
} from "@blueprintjs/core";
import { useCallback, useEffect, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { articlesApi, projectsApi } from "../api";
import { useToaster } from "../hooks/useToaster";
import type { Article, Project, ProjectStats, SettingsSection } from "../types";
import { ArticleView } from "./ArticleView";
import { ProjectHome } from "./ProjectHome";
import { ProjectOnboarding } from "./ProjectOnboarding";
import { ArticleSidebar } from "./project-detail/ArticleSidebar";
import { ProjectHomeHeader } from "./project-detail/ProjectHomeHeader";
import { SettingsContent } from "./project-detail/SettingsContent";
import { SettingsSidebar } from "./project-detail/SettingsSidebar";
import { SidebarExportDock } from "./project-detail/SidebarExportDock";
import { SidebarHeader } from "./project-detail/SidebarHeader";

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
  const [activeTab, setActiveTab] = useState<"home" | "articles" | "settings">(
    "home",
  );
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

  // Filter/Sort/Pagination state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [skip, setSkip] = useState(0);
  const LIMIT = 50;

  const { toaster } = useToaster();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
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

  // If onboarding is not completed, show the onboarding view
  if (!project.onboarding_completed) {
    return (
      <div className="h-full overflow-y-auto bg-gray-50">
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

  const handleToggleCheck = (id: string) => {
    const next = new Set(checkedArticleIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCheckedArticleIds(next);
  };

  const handleToggleCheckAll = () => {
    if (checkedArticleIds.size === articles.length) {
      setCheckedArticleIds(new Set());
    } else {
      setCheckedArticleIds(new Set(articles.map((a) => a.id)));
    }
  };

  const entityLabels = Object.keys(project.extraction_config?.entities || {});

  return (
    <PanelGroup direction="horizontal" className="h-full overflow-hidden">
      {activeTab !== "home" && (
        <>
          <Panel
            defaultSize={25}
            minSize={15}
            maxSize={40}
            className="flex flex-col bg-gray-50 border-r border-gray-200"
          >
            <SidebarHeader
              project={project}
              activeTab={activeTab}
              articlesCount={articles.length}
              onBack={onBack}
              onTabChange={setActiveTab}
            />
            <div className="grow overflow-y-clip">
              {activeTab === "articles" ? (
                <ArticleSidebar
                  project={project}
                  articles={articles}
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
                  onOpenImportDialog={() => setIsImportDialogOpen(true)}
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
          <PanelResizeHandle className="w-1.5 bg-gray-100 hover:bg-blue-200 transition-colors border-x border-gray-200 flex items-center justify-center group cursor-col-resize">
            <div className="w-0.5 h-8 bg-gray-300 group-hover:bg-blue-400 rounded-full" />
          </PanelResizeHandle>
        </>
      )}

      {/* Main Content */}
      <Panel className="bg-white flex flex-col overflow-hidden">
        {activeTab === "home" ? (
          <>
            <ProjectHomeHeader
              project={project}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              articlesCount={articles.length}
            />
            <div className="grow overflow-y-auto">
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
                                }}              />
            </div>
          </>
        ) : activeTab === "articles" ? (
          selectedArticle ? (
            <div className="grow overflow-y-auto">
                <ArticleView
                  article={selectedArticle}
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
                />
            </div>
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
      </Panel>

      <Dialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        title="Import Article URLs"
      >
        <div className="p-6">
          <p className="mb-4 text-gray-500">
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
    </PanelGroup>
  );
}
