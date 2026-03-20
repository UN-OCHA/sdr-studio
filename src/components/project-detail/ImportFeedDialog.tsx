import {
  Button,
  Card,
  Collapse,
  Dialog,
  Divider,
  Elevation,
  FormGroup,
  HTMLSelect,
  InputGroup,
  Intent,
  MenuItem,
  NumericInput,
} from "@blueprintjs/core";
import { Select, type ItemRenderer } from "@blueprintjs/select";
import { useState } from "react";
import { projectsApi } from "../../api";
import { useToaster } from "../../hooks/useToaster";
import type { Project } from "../../types";

interface ImportFeedDialogProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

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

const SOURCE_LABELS: Record<string, string> = {
  rss: "Feed URL",
  exa: "Search Query",
  brave: "Search Query",
};

const SOURCE_TYPE_MAP = Object.fromEntries(SOURCE_TYPES.map(s => [s.value, s]));

export function ImportFeedDialog({
  project,
  isOpen,
  onClose,
  onRefresh,
}: ImportFeedDialogProps) {
  const [type, setType] = useState("rss");
  const [url, setUrl] = useState("");
  const [config, setConfig] = useState<any>({ limit: 10 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { toaster } = useToaster();

  const handleImport = async () => {
    if (!url) {
      toaster?.show({ message: "Please enter a URL or query", intent: Intent.WARNING });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await projectsApi.discoverArticles(project.id, {
        type,
        url,
        config,
      });
      toaster?.show({
        message: result.message,
        intent: Intent.SUCCESS,
        icon: "tick",
      });
      onRefresh();
      onClose();
      setUrl("");
    } catch (err: any) {
      toaster?.show({
        message: err.message || "Discovery failed",
        intent: Intent.DANGER,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateConfig = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
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

  const currentSourceType = SOURCE_TYPE_MAP[type] || SOURCE_TYPES[0];

  const sourceLabel = SOURCE_LABELS[type] || "URL";

  return (
    <Dialog
      title="Import from Feed or Search"
      isOpen={isOpen}
      onClose={onClose}
      style={{ width: "500px" }}
    >
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <FormGroup label="Type">
              <Select<SourceTypeOption>
                items={SOURCE_TYPES}
                itemRenderer={renderSourceType}
                onItemSelect={(item) => {
                  setType(item.value);
                  setConfig({ limit: 10 });
                }}
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
            <FormGroup label={sourceLabel} labelInfo="(required)">
              <InputGroup
                placeholder={
                  type === "rss"
                    ? "https://reliefweb.int/updates/rss.xml"
                    : "e.g. floods in South Sudan 2024"
                }
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </FormGroup>
          </div>
        </div>

        {(type === "exa" || type === "brave") && (
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
                      value={config.limit || 10}
                      onValueChange={(val) => updateConfig("limit", val)}
                    />
                  </FormGroup>

                  {type === "exa" && (
                    <FormGroup label="Search Type" className="mb-0">
                      <HTMLSelect
                        fill
                        value={config.search_type || "neural"}
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

                  {type === "brave" && (
                    <FormGroup label="Freshness" className="mb-0">
                      <HTMLSelect
                        fill
                        value={config.freshness || ""}
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

                {type === "exa" && (
                  <>
                    <FormGroup label="Category">
                      <HTMLSelect
                        fill
                        value={config.category || ""}
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
                        value={config.published_after || ""}
                        onChange={(e) =>
                          updateConfig("published_after", e.target.value)
                        }
                      />
                    </FormGroup>
                  </>
                )}

                {type === "brave" && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormGroup label="Country (2-letter)">
                      <InputGroup
                        placeholder="US, GB, etc."
                        value={config.country || ""}
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
                        value={config.search_lang || ""}
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
          <Button text="Cancel" onClick={onClose} />
          <Button
            intent={Intent.PRIMARY}
            text="Run Discovery"
            loading={isSubmitting}
            onClick={handleImport}
          />
        </div>
      </div>
    </Dialog>
  );
}
