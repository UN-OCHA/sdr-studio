import {
  Button,
  Checkbox,
  Icon,
  InputGroup,
  Intent,
  Menu,
  MenuDivider,
  MenuItem,
  NonIdealState,
  Popover,
  ProgressBar,
  Tooltip,
} from "@blueprintjs/core";
import TimeAgo from "react-timeago";
import { projectsApi } from "../../api";
import { useExportToken, useSources } from "../../hooks/queries";
import type { Article, Project, ProjectStats } from "../../types";

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
  { label: "Queued", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Error", value: "error" },
];

const SOURCE_FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: "All Sources", value: "all" },
  { label: "Manual", value: "manual" },
  { label: "RSS", value: "rss" },
  { label: "Exa", value: "exa" },
  { label: "Brave", value: "brave" },
];

type ArticleSidebarProps = {
  project: Project;
  articles: Article[];
  totalCount: number;
  stats: ProjectStats | null;
  isLoading: boolean;
  selectedArticleId: string | null;
  checkedArticleIds: Set<string>;
  search: string;
  statusFilter: string;
  sourceFilter: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (status: string) => void;
  onSourceFilterChange: (source: string) => void;
  onSortByChange: (sortBy: string) => void;
  onSortOrderToggle: () => void;
  onArticleSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleCheckAll: () => void;
  onBulkDelete: () => void;
  onRefresh: () => void;
  onReprocessAll: () => void;
  onRetryArticle: (id: string) => void;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onOpenUrlImportDialog: () => void;
  onOpenFeedImportDialog: () => void;
  pinnedArticles: Article[];
  onTogglePin: (article: Article) => void;
  onClearPinned: () => void;
};

export function ArticleSidebar({
  project,
  articles,
  totalCount,
  stats,
  selectedArticleId,
  checkedArticleIds,
  search,
  statusFilter,
  sourceFilter,
  sortBy,
  sortOrder,
  onSearchChange,
  onStatusFilterChange,
  onSourceFilterChange,
  onSortByChange,
  onSortOrderToggle,
  onArticleSelect,
  onToggleCheck,
  onToggleCheckAll,
  onBulkDelete,
  onRefresh,
  onReprocessAll,
  onRetryArticle,
  page,
  limit,
  onPageChange,
  onOpenUrlImportDialog,
  onOpenFeedImportDialog,
  pinnedArticles,
  onTogglePin,
  onClearPinned,
}: ArticleSidebarProps) {
  const isProcessing = stats && (stats.pending > 0 || stats.processing > 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const exportTokenMutation = useExportToken();
  const { data: sources = [] } = useSources(project.id);

  const getSourceDisplay = (article: Article) => {
    const type = article.source_type || "manual";
    const source = sources.find((s) => s.id === article.source_id);

    return (
      <div
        className="flex items-center gap-1 shrink-0"
        title={
          source ? `Source: ${source.name}` : `Type: ${type.toUpperCase()}`
        }
      >
        <Icon
          icon={
            type === "rss"
              ? "feed"
              : type === "exa" || type === "brave"
                ? "search"
                : "import"
          }
          size={10}
        />
        <span className="truncate max-w-[80px]">
          {source
            ? source.name
            : type === "manual"
              ? "Manual"
              : type.toUpperCase()}
        </span>
      </div>
    );
  };

  const getStatusIcon = (article: Article) => {
    if (article.reviewed) {
      return <Icon icon="endorsed" intent={Intent.SUCCESS} title="Reviewed" />;
    }
    switch (article.status) {
      case "completed":
        return (
          <Icon icon="tick-circle" intent={Intent.SUCCESS} title="Completed" />
        );
      case "processing":
        return (
          <Icon
            icon="refresh"
            intent={Intent.PRIMARY}
            className="animate-spin"
            title="Processing..."
          />
        );
      case "pending":
        return <Icon icon="time" intent={Intent.NONE} title="Queued" />;
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
        return <Icon icon="circle" intent={Intent.NONE} title="Unknown" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-2 border-b border-gray-200 dark:border-bp-dark-border bg-gray-100 dark:bg-bp-dark-header space-y-2">
        <div className="flex gap-2">
          <InputGroup
            leftIcon="search"
            placeholder="Search articles..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="grow"
            small
          />
          <Popover
            minimal
            placement="auto-start"
            content={
              <Menu>
                <MenuItem
                  icon="link"
                  text="From URLs"
                  onClick={onOpenUrlImportDialog}
                />
                <MenuItem
                  icon="feed"
                  text="From feeds"
                  onClick={onOpenFeedImportDialog}
                />
              </Menu>
            }
            position="bottom-right"
          >
            <Button
              small
              intent={Intent.PRIMARY}
              icon="plus"
              title="Import Articles"
              text="Import"
              rightIcon="caret-down"
            />
          </Popover>
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
              onChange={onToggleCheckAll}
              className="mb-0! mr-1"
            />
            <Popover
              minimal
              placement="bottom-start"
              content={
                <Menu>
                  <MenuDivider title="Filter by Status" />
                  {STATUS_FILTER_OPTIONS.map((o) => (
                    <MenuItem
                      key={o.value}
                      text={o.label}
                      icon={statusFilter === o.value ? "tick" : "blank"}
                      active={statusFilter === o.value}
                      onClick={() => onStatusFilterChange(o.value)}
                    />
                  ))}
                  <MenuDivider title="Filter by Source" />
                  {SOURCE_FILTER_OPTIONS.map((o) => (
                    <MenuItem
                      key={o.value}
                      text={o.label}
                      icon={
                        sourceFilter === o.value
                          ? "tick"
                          : o.value === "rss"
                            ? "feed"
                            : o.value === "exa" || o.value === "brave"
                              ? "search"
                              : o.value === "manual"
                                ? "import"
                                : "blank"
                      }
                      active={sourceFilter === o.value}
                      onClick={() => onSourceFilterChange(o.value)}
                    />
                  ))}
                  <MenuDivider title="Sort Options" />
                  <MenuItem icon="sort" text="Sort By">
                    {SORT_OPTIONS.map((o) => (
                      <MenuItem
                        key={o.value}
                        text={o.label}
                        icon={sortBy === o.value ? "tick" : "blank"}
                        active={sortBy === o.value}
                        onClick={() => onSortByChange(o.value)}
                      />
                    ))}
                  </MenuItem>
                  <MenuItem
                    icon={sortOrder === "asc" ? "sort-asc" : "sort-desc"}
                    text={sortOrder === "asc" ? "Ascending" : "Descending"}
                    onClick={onSortOrderToggle}
                  />
                </Menu>
              }
            >
              <Button
                size="small"
                variant="minimal"
                icon="properties"
                text="View"
                rightIcon="caret-down"
                intent={
                  statusFilter !== "all" || sourceFilter !== "all"
                    ? Intent.PRIMARY
                    : Intent.NONE
                }
              />
            </Popover>
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
                  onClick={onBulkDelete}
                />
                <Popover
                  content={
                    <Menu>
                      <MenuItem
                        icon="document"
                        text="Export Selected as JSON"
                        onClick={async () => {
                          const { token } =
                            await exportTokenMutation.mutateAsync();
                          const ids = Array.from(checkedArticleIds);
                          window.open(
                            projectsApi.exportJsonUrl(project.id, token, ids),
                            "_blank",
                          );
                        }}
                      />
                      <MenuItem
                        icon="th"
                        text="Export Selected as CSV"
                        onClick={async () => {
                          const { token } =
                            await exportTokenMutation.mutateAsync();
                          const ids = Array.from(checkedArticleIds);
                          window.open(
                            projectsApi.exportCsvUrl(project.id, token, ids),
                            "_blank",
                          );
                        }}
                      />
                      <MenuItem
                        icon="print"
                        text="Generate Report (MD)"
                        onClick={async () => {
                          const { token } =
                            await exportTokenMutation.mutateAsync();
                          const ids = Array.from(checkedArticleIds);
                          window.open(
                            projectsApi.exportReportUrl(
                              project.id,
                              token,
                              "md",
                              ids,
                            ),
                            "_blank",
                          );
                        }}
                      />
                    </Menu>
                  }
                  position="bottom"
                >
                  <Button
                    size="small"
                    variant="minimal"
                    icon="download"
                    title="Export Selected"
                    loading={exportTokenMutation.isPending}
                  />
                </Popover>
              </>
            ) : (
              <>
                <Button
                  small
                  minimal
                  icon="refresh"
                  title="Refresh List"
                  onClick={onRefresh}
                />
                <Button
                  small
                  minimal
                  icon="automatic-updates"
                  title="Reprocess All"
                  onClick={onReprocessAll}
                  intent={isProcessing ? Intent.PRIMARY : Intent.NONE}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {isProcessing && stats && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/50">
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
                  className={`flex items-start px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-bp-dark-border w-full min-w-0 group cursor-pointer ${
                    selectedArticleId === article.id
                      ? "bg-blue-50/50 dark:bg-blue-900/20"
                      : ""
                  }`}
                  onClick={() => onArticleSelect(article.id)}
                >
                  <Checkbox
                    checked={checkedArticleIds.has(article.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleCheck(article.id);
                    }}
                    className="mt-1! shrink-0 mr-2"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div
                        className="truncate text-sm font-bold flex-1"
                        title={article.title || article.url}
                      >
                        {article.title || article.url}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {article.status === "error" && (
                          <Button
                            size="small"
                            variant="minimal"
                            icon="refresh"
                            intent={Intent.PRIMARY}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRetryArticle(article.id);
                            }}
                            title="Retry"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        )}
                        {getStatusIcon(article)}
                      </div>
                    </div>

                    <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mb-1 italic">
                      {article.summary || "No summary available"}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                      <Icon icon="calendar" size={10} />
                      <TimeAgo date={article.created_at} />
                      <span className="text-gray-200">|</span>
                      {getSourceDisplay(article)}
                    </div>
                  </div>
                </div>
              ))}
            </Menu>

            {/* Pagination Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-bp-dark-bg border-t border-gray-200 dark:border-bp-dark-border p-1 px-2 flex items-center justify-between shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-0.5">
                <Button
                  small
                  minimal
                  icon="chevron-left"
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                  className="h-6 w-6 p-0"
                />
                <div className="text-[9px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-bp-dark-header px-1.5 py-0.5 rounded border border-gray-200 dark:border-bp-dark-border min-w-[50px] text-center tracking-tighter">
                  {page} / {totalPages}
                </div>
                <Button
                  small
                  minimal
                  icon="chevron-right"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange(page + 1)}
                  className="h-6 w-6 p-0"
                />
              </div>
              <div className="text-[9px] font-black uppercase text-gray-400 tracking-tighter">
                {totalCount} Total
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pinned Articles Section */}
      {pinnedArticles.length > 0 && (
        <div className="border-t-2 border-blue-500 bg-blue-50/30 dark:bg-blue-900/10 flex flex-col max-h-64 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <div className="px-3 py-2 flex items-center justify-between border-b border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-2">
              <Icon icon="star" intent={Intent.PRIMARY} size={14} />
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Report ({pinnedArticles.length})
              </span>
            </div>
            <div className="flex gap-1">
              <Popover
                content={
                  <Menu>
                    <MenuItem
                      icon="document"
                      text="Export Pinned as JSON"
                      onClick={async () => {
                        const { token } =
                          await exportTokenMutation.mutateAsync();
                        const ids = pinnedArticles.map((a) => a.id);
                        window.open(
                          projectsApi.exportJsonUrl(project.id, token, ids),
                          "_blank",
                        );
                      }}
                    />
                    <MenuItem
                      icon="th"
                      text="Export Pinned as CSV"
                      onClick={async () => {
                        const { token } =
                          await exportTokenMutation.mutateAsync();
                        const ids = pinnedArticles.map((a) => a.id);
                        window.open(
                          projectsApi.exportCsvUrl(project.id, token, ids),
                          "_blank",
                        );
                      }}
                    />
                    <MenuItem
                      icon="print"
                      text="Generate Report for Pinned (MD)"
                      onClick={async () => {
                        const { token } =
                          await exportTokenMutation.mutateAsync();
                        const ids = pinnedArticles.map((a) => a.id);
                        window.open(
                          projectsApi.exportReportUrl(
                            project.id,
                            token,
                            "md",
                            ids,
                          ),
                          "_blank",
                        );
                      }}
                    />
                  </Menu>
                }
                position="top-right"
              >
                <Button
                  small
                  minimal
                  intent={Intent.PRIMARY}
                  icon="download"
                  text="Export"
                  loading={exportTokenMutation.isPending}
                />
              </Popover>
              <Button
                small
                minimal
                icon="cross"
                onClick={onClearPinned}
                title="Clear all pinned"
              />
            </div>
          </div>
          <div className="grow overflow-y-auto px-1 py-1">
            {pinnedArticles.map((article) => (
              <div
                key={article.id}
                className="flex items-center justify-between p-1.5 hover:bg-white dark:hover:bg-bp-dark-bg rounded transition-colors group cursor-pointer"
                onClick={() => onArticleSelect(article.id)}
              >
                <span className="text-[11px] font-medium truncate flex-1 pr-2">
                  {article.title || article.url}
                </span>
                <Button
                  small
                  minimal
                  icon="small-cross"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(article);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
