import {
  Button,
  Checkbox,
  Dialog,
  EntityTitle,
  H3,
  H4,
  Icon,
  InputGroup,
  Intent,
  Menu,
  MenuItem,
  NonIdealState,
  Popover,
  ProgressBar,
  Tab,
  Tabs,
  TextArea,
  Tooltip,
  type IconName,
} from "@blueprintjs/core";
import { Select, type ItemRenderer } from "@blueprintjs/select";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { articlesApi, projectsApi } from "../api";
import { useToaster } from "../hooks/useToaster";
import type { Article, Project } from "../types";
import { ArticleView } from "./ArticleView";
import { ExtractionSettings } from "./project-settings/ExtractionSettings";
import {
  MonitoringStation,
  type MonitoringStationRef,
} from "./MonitoringStation";
import { GeneralSettings } from "./project-settings/GeneralSettings";
import { ModelLibrary } from "./project-settings/ModelLibrary";
import { ProjectProfile } from "./project-settings/ProjectProfile";
import { ProjectOnboarding } from "./ProjectOnboarding";

type ProjectStats = {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  error: number;
};

type ProjectDetailProps = {
  project: Project;
  onImportUrls: (urls: string[]) => void;
  onUpdateProject: (project: Project) => void;
  onBack: () => void;
};

type SortOption = {
  label: string;
  value: string;
};

const SORT_OPTIONS: SortOption[] = [
  { label: "Date Found", value: "created_at" },
  { label: "Title", value: "title" },
];

type StatusFilterOption = {
  label: string;
  value: string;
};

const STATUS_FILTER_OPTIONS: StatusFilterOption[] = [
  { label: "All Statuses", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Processing", value: "processing" },
  { label: "Error", value: "error" },
];

export function ProjectDetail({
  project,
  onImportUrls,
  onUpdateProject,
  onBack,
}: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<
    "articles" | "schema" | "settings" | "monitoring"
  >("articles");
  const [settingsSection, setSettingsSection] = useState<
    "profile" | "general" | "library" | "schema" | "monitoring"
  >("profile");

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
  const monitoringRef = useRef<MonitoringStationRef>(null);

  const renderSortOption: ItemRenderer<SortOption> = (
    option,
    { handleClick, handleFocus, modifiers },
  ) => {
    if (!modifiers.matchesPredicate) return null;
    return (
      <MenuItem
        active={modifiers.active}
        disabled={modifiers.disabled}
        key={option.value}
        onClick={handleClick}
        onFocus={handleFocus}
        text={option.label}
      />
    );
  };

  const renderStatusOption: ItemRenderer<StatusFilterOption> = (
    option,
    { handleClick, handleFocus, modifiers },
  ) => {
    if (!modifiers.matchesPredicate) return null;
    return (
      <MenuItem
        active={modifiers.active}
        disabled={modifiers.disabled}
        key={option.value}
        onClick={handleClick}
        onFocus={handleFocus}
        text={option.label}
      />
    );
  };

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "Sort By";
  const currentStatusLabel =
    STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label ||
    "Filter Status";

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

  const handleSaveConfig = async (newConfig: Project["extraction_config"]) => {
    try {
      setIsSaving(true);
      const updated = await projectsApi.update(project.id, {
        extraction_config: newConfig,
      });
      onUpdateProject(updated);
      toaster?.show({
        message: "Project schema updated successfully",
        intent: Intent.SUCCESS,
        icon: "tick",
      });
    } catch (err) {
      console.error("Failed to save configuration:", err);
      toaster?.show({
        message: "Failed to update project schema",
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

  const getStatusIcon = (article: Article) => {
    if (article.reviewed) {
      return <Icon icon="endorsed" intent={Intent.SUCCESS} title="Reviewed" />;
    }
    switch (article.status) {
      case "completed":
        return <Icon icon="tick-circle" intent={Intent.SUCCESS} />;
      case "processing":
        return (
          <Icon
            icon="refresh"
            intent={Intent.PRIMARY}
            className="animate-spin"
          />
        );
      case "error":
        return (
          <Tooltip
            content={article.error_message || "Unknown error"}
            intent={Intent.DANGER}
          >
            <Icon icon="error" intent={Intent.DANGER} />
          </Tooltip>
        );
      default:
        return <Icon icon="circle" intent={Intent.NONE} />;
    }
  };

  const entityLabels = Object.keys(project.extraction_config?.entities || {});
  const isProcessing = stats && (stats.pending > 0 || stats.processing > 0);

  return (
    <PanelGroup direction="horizontal" className="h-full overflow-hidden">
      {/* Sidebar */}
      <Panel
        defaultSize={25}
        minSize={15}
        maxSize={40}
        className="flex flex-col bg-gray-50 border-r border-gray-200"
      >
        <div className="p-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <Button icon="arrow-left" onClick={onBack} variant="minimal" />
            <Icon
              icon={project.icon as IconName}
              size={16}
              className="text-gray-500"
            />

            <H4 title={project.name} className="mb-0! truncate">
              {project.name}
            </H4>
          </div>
          <Tabs
            id="ProjectSidebarTabs"
            selectedTabId={activeTab}
            onChange={(id) => setActiveTab(id as typeof activeTab)}
          >
            <Tab id="articles" title="Articles" icon="document" />
            <Tab id="settings" title="Settings" icon="cog" />
          </Tabs>
        </div>

        <div className="grow overflow-y-clip">
          {activeTab === "articles" ? (
            <div className="flex flex-col h-full">
              {/* Toolbar */}
              <div className="p-2 border-b border-gray-200 bg-gray-100 space-y-2">
                <div className="flex gap-2">
                  <InputGroup
                    leftIcon="search"
                    placeholder="Search articles..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="grow"
                    small
                  />
                  <Button
                    small
                    intent={Intent.PRIMARY}
                    icon="plus"
                    title="Import Articles"
                    text="Import"
                    onClick={() => setIsImportDialogOpen(true)}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={
                        checkedArticleIds.size > 0 &&
                        checkedArticleIds.size === articles.length
                      }
                      indeterminate={
                        checkedArticleIds.size > 0 &&
                        checkedArticleIds.size < articles.length
                      }
                      onChange={handleToggleCheckAll}
                      className="mb-0! mr-1"
                    />
                    <Select<StatusFilterOption>
                      items={STATUS_FILTER_OPTIONS}
                      itemRenderer={renderStatusOption}
                      onItemSelect={(o) => setStatusFilter(o.value)}
                      filterable={false}
                      popoverProps={{ minimal: true, matchTargetWidth: true }}
                    >
                      <Button
                        small
                        minimal
                        text={
                          currentStatusLabel === "All Statuses"
                            ? "All"
                            : currentStatusLabel
                        }
                        rightIcon="filter"
                        title="Filter by Status"
                      />
                    </Select>
                    <Select<SortOption>
                      items={SORT_OPTIONS}
                      itemRenderer={renderSortOption}
                      onItemSelect={(o) => setSortBy(o.value)}
                      filterable={false}
                      popoverProps={{ minimal: true }}
                    >
                      <Button
                        small
                        minimal
                        icon={sortOrder === "asc" ? "sort-asc" : "sort-desc"}
                        text={
                          currentSortLabel === "Date Found" ? "Date" : "Title"
                        }
                        onClick={() => {
                          // If clicking the icon area, toggle order, otherwise open select
                          // Actually Blueprint Select handles click to open.
                          // Let's just make it a select for now.
                        }}
                      />
                    </Select>
                    <Button
                      small
                      minimal
                      icon="swap-vertical"
                      title="Toggle Sort Direction"
                      onClick={() =>
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                      }
                    />
                  </div>

                  <div className="flex gap-1">
                    {checkedArticleIds.size > 0 ? (
                      <>
                        <Button
                          small
                          minimal
                          icon="trash"
                          intent={Intent.DANGER}
                          title={`Delete ${checkedArticleIds.size} Selected`}
                          onClick={handleBulkDelete}
                        />
                        <Button
                          small
                          minimal
                          icon="download"
                          title="Export Selected"
                          onClick={() => {
                            const ids = Array.from(checkedArticleIds);
                            window.open(
                              projectsApi.exportJsonUrl(project.id, ids),
                              "_blank",
                            );
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <Button
                          small
                          minimal
                          icon="refresh"
                          title="Refresh List"
                          onClick={() => void fetchArticles(false)}
                        />
                        <Button
                          small
                          minimal
                          icon="automatic-updates"
                          title="Reprocess All"
                          onClick={handleReprocessAll}
                          intent={isProcessing ? Intent.PRIMARY : Intent.NONE}
                        />
                        <Popover
                          content={
                            <Menu>
                              <MenuItem
                                icon="document"
                                text="Export as JSON"
                                onClick={() =>
                                  window.open(
                                    projectsApi.exportJsonUrl(project.id),
                                    "_blank",
                                  )
                                }
                              />
                              <MenuItem
                                icon="th"
                                text="Export as CSV"
                                onClick={() =>
                                  window.open(
                                    projectsApi.exportCsvUrl(project.id),
                                    "_blank",
                                  )
                                }
                              />
                            </Menu>
                          }
                          position="bottom"
                        >
                          <Button
                            small
                            minimal
                            icon="download"
                            title="Export Options"
                          />
                        </Popover>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isProcessing && stats && (
                <div className="p-3 bg-blue-50 border-b border-blue-100">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-blue-600 mb-1">
                    <span>Processing Articles...</span>
                    <span>
                      {stats.completed + stats.error} / {stats.total}
                    </span>
                  </div>
                  <ProgressBar
                    intent={Intent.PRIMARY}
                    value={(stats.completed + stats.error) / stats.total}
                    stripes={true}
                    animate={true}
                    className="h-1.5"
                  />
                </div>
              )}

              <div className="grow overflow-y-auto overflow-x-hidden">
                {articles.length === 0 ? (
                  <NonIdealState
                    icon="document"
                    title="No Articles"
                    description={
                      search || statusFilter !== "all"
                        ? "No articles match your filters."
                        : "Import some URLs to get started."
                    }
                    className="p-4"
                  />
                ) : (
                  <>
                    <Menu className="bg-transparent p-0! w-full">
                      {articles.map((article) => (
                        <div
                          key={article.id}
                          className="flex items-center px-2 py-1 hover:bg-gray-100 border-b border-gray-200 w-full min-w-0 group cursor-pointer"
                          onClick={() => setSelectedArticleId(article.id)}
                        >
                          <Checkbox
                            checked={checkedArticleIds.has(article.id)}
                            onChange={() => {
                              handleToggleCheck(article.id);
                            }}
                            className="mb-0! shrink-0 mr-2"
                          />

                          <div className="flex-1 min-w-0 flex items-center justify-between">
                            {/* Article Title / URL */}
                            <div
                              className="truncate pr-2 text-sm font-medium flex items-center gap-2"
                              title={article.title || article.url}
                            >
                              <span className="truncate">
                                {article.title || article.url}
                              </span>
                            </div>

                            {/* Status Icons */}
                            <div className="flex items-center gap-2 shrink-0 ml-auto">
                              {article.status === "error" && (
                                <Button
                                  size="small"
                                  variant="minimal"
                                  icon="refresh"
                                  intent={Intent.PRIMARY}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleRetryArticle(article.id);
                                  }}
                                  title="Retry"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                />
                              )}
                              {getStatusIcon(article)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </Menu>
                    {articles.length < totalCount && (
                      <div className="p-4 flex justify-center">
                        <Button
                          loading={isLoading}
                          text="Load More"
                          onClick={() => void fetchArticles(true)}
                          minimal
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-xs text-gray-500 uppercase font-bold mb-4">
                Configuration
              </p>
              <Menu className="bg-transparent p-0">
                <MenuItem
                  icon="info-sign"
                  text="Project Profile"
                  active={settingsSection === "profile"}
                  onClick={() => setSettingsSection("profile")}
                />
                <MenuItem
                  icon="predictive-analysis"
                  text="Intelligence Engine"
                  active={settingsSection === "general"}
                  onClick={() => setSettingsSection("general")}
                />
                <MenuItem
                  icon="box"
                  text="Model Library"
                  active={settingsSection === "library"}
                  onClick={() => setSettingsSection("library")}
                />
                <MenuItem
                  icon="tag"
                  text="Extraction Schema"
                  active={settingsSection === "schema"}
                  onClick={() => setSettingsSection("schema")}
                />
                <MenuItem
                  icon="feed"
                  text="Monitoring Station"
                  active={settingsSection === "monitoring"}
                  onClick={() => setSettingsSection("monitoring")}
                />
              </Menu>
            </div>
          )}
        </div>
      </Panel>

      <PanelResizeHandle className="w-1.5 bg-gray-100 hover:bg-blue-200 transition-colors border-x border-gray-200 flex items-center justify-center group cursor-col-resize">
        <div className="w-0.5 h-8 bg-gray-300 group-hover:bg-blue-400 rounded-full" />
      </PanelResizeHandle>

      {/* Main Content */}
      <Panel className="bg-white flex flex-col overflow-hidden">
        <div className="grow overflow-y-auto">
          {activeTab === "articles" ? (
            selectedArticle ? (
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
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <EntityTitle
                  title={
                    settingsSection === "profile"
                      ? "Project Profile"
                      : settingsSection === "general"
                        ? "Intelligence Engine"
                        : settingsSection === "library"
                          ? "Model Library"
                          : settingsSection === "monitoring"
                            ? "Monitoring Station"
                            : "Extraction Schema"
                  }
                  subtitle={
                    settingsSection === "profile"
                      ? "Identity and basic information."
                      : settingsSection === "general"
                        ? "Model and sensitivity parameters."
                        : settingsSection === "library"
                          ? "Manage trained LoRA adapters."
                          : settingsSection === "monitoring"
                            ? "Automated article discovery."
                            : "Define categories and structures to recognize."
                  }
                  heading={H3}
                />
                <div className="flex gap-2">
                  {settingsSection === "monitoring" && (
                    <Button
                      intent={Intent.PRIMARY}
                      icon="plus"
                      text="Add Source"
                      onClick={() => monitoringRef.current?.openAddSource()}
                    />
                  )}
                  {settingsSection !== "library" &&
                    settingsSection !== "monitoring" && (
                      <Button
                        intent={Intent.PRIMARY}
                        icon="floppy-disk"
                        text="Save Settings"
                        loading={isSaving}
                        onClick={() => {
                          if (settingsSection === "schema") {
                            // Logic handled in child via props (though we could unify)
                          } else if (settingsSection === "profile") {
                            handleUpdateProjectDetails(pendingProjectUpdates);
                            setPendingProjectUpdates({});
                          } else {
                            handleSaveConfig(project.extraction_config);
                          }
                        }}
                      />
                    )}
                </div>
              </div>

              {settingsSection === "profile" && (
                <ProjectProfile
                  project={{ ...project, ...pendingProjectUpdates }}
                  onChange={(updates) =>
                    setPendingProjectUpdates((prev) => ({
                      ...prev,
                      ...updates,
                    }))
                  }
                />
              )}

              {settingsSection === "general" && (
                <GeneralSettings
                  config={project.extraction_config}
                  onUpdateConfig={(updates) =>
                    handleSaveConfig({
                      ...project.extraction_config,
                      ...updates,
                    })
                  }
                />
              )}

              {settingsSection === "library" && (
                <ModelLibrary
                  project={project}
                  onProjectUpdate={onUpdateProject}
                />
              )}

              {settingsSection === "schema" && (
                <ExtractionSettings
                  config={project.extraction_config}
                  onSave={handleSaveConfig}
                  isSaving={isSaving}
                  hideHeader
                />
              )}

              {settingsSection === "monitoring" && (
                <MonitoringStation project={project} ref={monitoringRef} />
              )}
            </div>
          )}
        </div>
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
