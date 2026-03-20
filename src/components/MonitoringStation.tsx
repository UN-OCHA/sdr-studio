import {
  Button,
  Callout,
  Card,
  Collapse,
  Dialog,
  Divider,
  Elevation,
  FormGroup,
  HTMLSelect,
  HTMLTable,
  InputGroup,
  Intent,
  MenuItem,
  NonIdealState,
  NumericInput,
  Spinner,
  Switch,
  Tag,
} from "@blueprintjs/core";
import { Select, type ItemRenderer } from "@blueprintjs/select";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { sourcesApi } from "../api";
import { useToaster } from "../hooks/useToaster";
import type { Project, Source } from "../types";

export interface MonitoringStationRef {
  openAddSource: () => void;
}

interface MonitoringStationProps {
  project: Project;
}

type PollingUnit = "min" | "hour" | "day";

interface SourceTypeOption {
  label: string;
  value: string;
  description: string;
}

const SOURCE_TYPES: SourceTypeOption[] = [
  {
    label: "RSS Feed",
    value: "rss",
    description: "Standard RSS/Atom/XML feed.",
  },
  {
    label: "Exa Discovery",
    value: "exa",
    description: "AI-native search for high-quality links.",
  },
  {
    label: "Brave Search",
    value: "brave",
    description: "Standard web search via Brave's API.",
  },
];

const TYPE_INTENTS: Record<string, Intent> = {
  rss: Intent.NONE,
  exa: Intent.PRIMARY,
  brave: Intent.SUCCESS,
};

const SOURCE_LABELS: Record<string, string> = {
  rss: "Feed URL",
  exa: "Search Query",
  brave: "Search Query",
};

export const MonitoringStation = forwardRef<
  MonitoringStationRef,
  MonitoringStationProps
>(({ project }, ref) => {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [pollingUnit, setPollingUnit] = useState<PollingUnit>("min");
  const [tempInterval, setTempInterval] = useState(15);

  const [newSource, setNewSource] = useState({
    name: "",
    url: "",
    type: "rss",
    polling_interval: 15,
    config: {} as any,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToaster } = useToaster();

  useImperativeHandle(ref, () => ({
    openAddSource: () => setIsAddDialogOpen(true),
  }));

  const fetchSources = useCallback(async () => {
    try {
      const data = await sourcesApi.list(project.id);
      setSources(data);
    } catch {
      showToaster("Failed to fetch sources", Intent.DANGER);
    } finally {
      setLoading(false);
    }
  }, [project.id, showToaster]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleAddSource = async () => {
    if (!newSource.name || !newSource.url) {
      showToaster("Please fill in all fields", Intent.WARNING);
      return;
    }

    // Convert tempInterval to minutes for the backend
    let intervalInMinutes = tempInterval;
    if (pollingUnit === "hour") intervalInMinutes *= 60;
    if (pollingUnit === "day") intervalInMinutes *= 1440;

    setIsSubmitting(true);
    try {
      await sourcesApi.create(project.id, {
        ...newSource,
        polling_interval: intervalInMinutes,
      });
      showToaster("Source added successfully", Intent.SUCCESS);
      setIsAddDialogOpen(false);
      setNewSource({
        name: "",
        url: "",
        type: "rss",
        polling_interval: 15,
        config: {},
      });
      setTempInterval(15);
      setPollingUnit("min");
      setShowAdvanced(false);
      fetchSources();
    } catch {
      showToaster("Failed to add source", Intent.DANGER);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (source: Source) => {
    try {
      await sourcesApi.update(source.id, { active: !source.active });
      setSources((prev) =>
        prev.map((s) =>
          s.id === source.id ? { ...s, active: !source.active } : s,
        ),
      );
    } catch {
      showToaster("Failed to update source", Intent.DANGER);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm("Are you sure you want to delete this source?")) return;

    try {
      await sourcesApi.delete(sourceId);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      showToaster("Source deleted", Intent.SUCCESS);
    } catch {
      showToaster("Failed to delete source", Intent.DANGER);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Spinner size={50} />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading monitoring sources...</p>
      </div>
    );
  }

  const updateConfig = (key: string, value: any) => {
    setNewSource((prev) => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  const formatInterval = (mins: number) => {
    if (mins >= 1440 && mins % 1440 === 0) return `${mins / 1440}d`;
    if (mins >= 60 && mins % 60 === 0) return `${mins / 60}h`;
    return `${mins}m`;
  };

  const renderSourceType: ItemRenderer<SourceTypeOption> = (
    item,
    { handleClick, handleFocus, modifiers },
  ) => {
    if (!modifiers.matchesPredicate) return null;
    return (
      <MenuItem
        active={modifiers.active}
        disabled={modifiers.disabled}
        key={item.value}
        onClick={handleClick}
        onFocus={handleFocus}
        text={
          <div>
            <div className="font-bold text-xs">{item.label}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
              {item.description}
            </div>
          </div>
        }
        multiline
      />
    );
  };

  const currentSourceType =
    SOURCE_TYPES.find((s) => s.value === newSource.type) || SOURCE_TYPES[0];

  return (
    <div className="space-y-6">
      <Callout intent={Intent.PRIMARY} icon="info-sign" title="How it works">
        The Monitoring Station automatically searches for new articles from
        different sources based on their individual refresh intervals. RSS feeds
        and search APIs are supported, bringing you new relevant articles to
        analyze periodically.
      </Callout>

      {sources.length === 0 ? (
        <Card
          elevation={Elevation.ZERO}
          className="p-12 border-dashed border-2 border-gray-200 dark:border-bp-dark-border flex flex-col items-center"
        >
          <NonIdealState
            icon="feed"
            title="No Sources Configured"
            description="Add an RSS feed or a Discovery source to start automated monitoring."
            action={
              <Button
                intent={Intent.PRIMARY}
                icon="plus"
                text="Add Source"
                onClick={() => setIsAddDialogOpen(true)}
              />
            }
          />
        </Card>
      ) : (
        <Card elevation={Elevation.ONE} className="p-0 overflow-hidden">
          <HTMLTable striped interactive className="mb-0 w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Interval</th>
                <th>Status</th>
                <th>Last Polled</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id}>
                  <td className="font-medium">{source.name}</td>
                  <td>
                    <Tag minimal intent={TYPE_INTENTS[source.type] || Intent.NONE}>
                      {source.type.toUpperCase()}
                    </Tag>
                  </td>
                  <td className="text-xs font-bold text-blue-600">
                    {formatInterval(source.polling_interval)}
                  </td>
                  <td>
                    <Switch
                      checked={source.active}
                      label={source.active ? "Active" : "Inactive"}
                      onChange={() => handleToggleActive(source)}
                      className="mb-0"
                    />
                  </td>
                  <td className="text-xs text-gray-500 dark:text-gray-400">
                    {source.last_polled
                      ? new Date(source.last_polled).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="text-right">
                    <Button
                      minimal
                      small
                      intent={Intent.DANGER}
                      icon="trash"
                      onClick={() => handleDeleteSource(source.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </Card>
      )}

      <Dialog
        title="Add Monitoring Source"
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        style={{ width: "500px" }}
      >
        <div className="p-6 space-y-4">
          <FormGroup label="Source Name" labelInfo="(required)">
            <InputGroup
              placeholder="e.g. ReliefWeb Global Disaster Alerts"
              value={newSource.name}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </FormGroup>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <FormGroup label="Source Type">
                <Select<SourceTypeOption>
                  items={SOURCE_TYPES}
                  itemRenderer={renderSourceType}
                  onItemSelect={(item) =>
                    setNewSource((prev) => ({ ...prev, type: item.value, config: {} }))
                  }

                  filterable={false}
                  popoverProps={{ minimal: true, matchTargetWidth: true }}
                >
                  <Button
                    fill
                    text={currentSourceType.label}
                    rightIcon="double-caret-vertical"
                    alignText="left"
                    variant="outlined"
                  />
                </Select>
              </FormGroup>
            </div>

            <div className="md:col-span-2">
              <FormGroup
                label="Polling Frequency"
                helperText={`Refresh every ${tempInterval} ${pollingUnit}${tempInterval > 1 ? "s" : ""}`}
                className="mb-0!"
              >
                <div className="flex gap-1">
                  <NumericInput
                    fill
                    min={1}
                    value={tempInterval}
                    onValueChange={(val) => {
                      if (!isNaN(val)) setTempInterval(val);
                    }}
                    className="grow"
                  />
                  <HTMLSelect
                    value={pollingUnit}
                    onChange={(e) =>
                      setPollingUnit(e.target.value as PollingUnit)
                    }
                    options={[
                      { label: "Mins", value: "min" },
                      { label: "Hours", value: "hour" },
                      { label: "Days", value: "day" },
                    ]}
                    style={{ width: "80px" }}
                  />
                </div>
              </FormGroup>
            </div>
          </div>

          <FormGroup
            label={SOURCE_LABELS[newSource.type] || "URL"}
            labelInfo="(required)"
          >
            <InputGroup
              placeholder={
                newSource.type === "rss"
                  ? "https://reliefweb.int/updates/rss.xml"
                  : "e.g. floods in South Sudan 2024"
              }
              value={newSource.url}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, url: e.target.value }))
              }
            />
          </FormGroup>

          {(newSource.type === "exa" || newSource.type === "brave") && (
            <>
              <Button
                minimal
                small
                icon={showAdvanced ? "chevron-up" : "chevron-down"}
                text={
                  showAdvanced
                    ? "Hide Advanced Settings"
                    : "Show Advanced Settings"
                }
                onClick={() => setShowAdvanced(!showAdvanced)}
              />

              <Collapse isOpen={showAdvanced}>
                <Card
                  elevation={Elevation.ZERO}
                  className="bg-gray-50 dark:bg-bp-dark-surface mt-2 space-y-3 border border-gray-200 dark:border-bp-dark-border"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormGroup label="Result Limit" className="mb-0">
                      <NumericInput
                        fill
                        min={1}
                        max={50}
                        value={newSource.config.limit || 10}
                        onValueChange={(val) => updateConfig("limit", val)}
                      />
                    </FormGroup>

                    {newSource.type === "exa" && (
                      <FormGroup label="Search Type" className="mb-0">
                        <HTMLSelect
                          fill
                          value={newSource.config.search_type || "neural"}
                          onChange={(e) =>
                            updateConfig("search_type", e.target.value)
                          }
                          options={[
                            { label: "Neural (AI)", value: "neural" },
                            { label: "Keyword", value: "keyword" },
                          ]}
                        />
                      </FormGroup>
                    )}

                    {newSource.type === "brave" && (
                      <FormGroup label="Freshness" className="mb-0">
                        <HTMLSelect
                          fill
                          value={newSource.config.freshness || ""}
                          onChange={(e) =>
                            updateConfig("freshness", e.target.value)
                          }
                          options={[
                            { label: "Anytime", value: "" },
                            { label: "Last 24h", value: "pd" },
                            { label: "Last Week", value: "pw" },
                            { label: "Last Month", value: "pm" },
                            { label: "Last Year", value: "py" },
                          ]}
                        />
                      </FormGroup>
                    )}
                  </div>

                  {newSource.type === "exa" && (
                    <>
                      <FormGroup label="Category">
                        <HTMLSelect
                          fill
                          value={newSource.config.category || ""}
                          onChange={(e) =>
                            updateConfig("category", e.target.value)
                          }
                          options={[
                            { label: "General", value: "" },
                            { label: "News", value: "news" },
                            {
                              label: "Research Paper",
                              value: "research paper",
                            },
                            { label: "Tweet", value: "tweet" },
                            { label: "Blog", value: "blog" },
                          ]}
                        />
                      </FormGroup>
                      <FormGroup label="Published After (ISO Date)">
                        <InputGroup
                          placeholder="YYYY-MM-DD"
                          value={newSource.config.published_after || ""}
                          onChange={(e) =>
                            updateConfig("published_after", e.target.value)
                          }
                        />
                      </FormGroup>
                    </>
                  )}

                  {newSource.type === "brave" && (
                    <div className="grid grid-cols-2 gap-4">
                      <FormGroup label="Country (2-letter)">
                        <InputGroup
                          placeholder="US, GB, etc."
                          value={newSource.config.country || ""}
                          onChange={(e) =>
                            updateConfig(
                              "country",
                              e.target.value.toUpperCase(),
                            )
                          }
                        />
                      </FormGroup>
                      <FormGroup label="Language (2-letter)">
                        <InputGroup
                          placeholder="en, fr, es"
                          value={newSource.config.search_lang || ""}
                          onChange={(e) =>
                            updateConfig(
                              "search_lang",
                              e.target.value.toLowerCase(),
                            )
                          }
                        />
                      </FormGroup>
                    </div>
                  )}
                </Card>
              </Collapse>
            </>
          )}

          <Divider />

          <div className="flex justify-end gap-2 pt-2">
            <Button text="Cancel" onClick={() => setIsAddDialogOpen(false)} />
            <Button
              intent={Intent.PRIMARY}
              text="Add Source"
              loading={isSubmitting}
              onClick={handleAddSource}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
});
