import {
  Button,
  Checkbox,
  Icon,
  InputGroup,
  Intent,
  Menu,
  MenuItem,
  NonIdealState,
  Popover,
  ProgressBar,
  Tooltip,
} from "@blueprintjs/core";
import { Select, type ItemRenderer } from "@blueprintjs/select";
import TimeAgo from "react-timeago";
import { projectsApi } from "../../api";
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
  { label: "Processing", value: "processing" },
  { label: "Error", value: "error" },
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
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (status: string) => void;
  onSortByChange: (sortBy: string) => void;
  onSortOrderToggle: () => void;
  onArticleSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleCheckAll: () => void;
  onBulkDelete: () => void;
  onRefresh: () => void;
  onReprocessAll: () => void;
  onRetryArticle: (id: string) => void;
  onLoadMore: () => void;
  onOpenUrlImportDialog: () => void;
  onOpenFeedImportDialog: () => void;
};

export function ArticleSidebar({
  project,
  articles,
  totalCount,
  stats,
  isLoading,
  selectedArticleId,
  checkedArticleIds,
  search,
  statusFilter,
  sortBy,
  sortOrder,
  onSearchChange,
  onStatusFilterChange,
  onSortByChange,
  onSortOrderToggle,
  onArticleSelect,
  onToggleCheck,
  onToggleCheckAll,
  onBulkDelete,
  onRefresh,
  onReprocessAll,
  onRetryArticle,
  onLoadMore,
  onOpenUrlImportDialog,
  onOpenFeedImportDialog,
}: ArticleSidebarProps) {
  const isProcessing = stats && (stats.pending > 0 || stats.processing > 0);

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
            <Select<StatusFilterOption>
              items={STATUS_FILTER_OPTIONS}
              itemRenderer={renderStatusOption}
              onItemSelect={(o) => onStatusFilterChange(o.value)}
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
              onItemSelect={(o) => onSortByChange(o.value)}
              filterable={false}
              popoverProps={{ minimal: true }}
            >
              <Button
                small
                minimal
                icon={sortOrder === "asc" ? "sort-asc" : "sort-desc"}
                text={currentSortLabel === "Date Found" ? "Date" : "Title"}
              />
            </Select>
            <Button
              small
              minimal
              icon="swap-vertical"
              title="Toggle Sort Direction"
              onClick={onSortOrderToggle}
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
                  onClick={onBulkDelete}
                />
                <Popover
                  content={
                    <Menu>
                      <MenuItem
                        icon="document"
                        text="Export Selected as JSON"
                        onClick={async () => {
                          const { token } = await projectsApi.getExportToken();
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
                          const { token } = await projectsApi.getExportToken();
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
                          const { token } = await projectsApi.getExportToken();
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
                    selectedArticleId === article.id ? "bg-blue-50/50 dark:bg-blue-900/20" : ""
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
                  onClick={onLoadMore}
                  minimal
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
