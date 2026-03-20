import {
  Button,
  Checkbox,
  Dialog,
  EntityTitle,
  FormGroup,
  H3,
  H5,
  HTMLSelect,
  InputGroup,
  Intent,
  Section,
  SectionCard,
  Spinner,
  Switch,
  TextArea,
} from "@blueprintjs/core";
import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import { projectsApi } from "../../api";
import type {
  ExportConfig,
  ExportField,
  Project,
  ReportSection,
} from "../../types";

type ExportSettingsProps = {
  projectId?: string;
  config: ExportConfig;
  extractionConfig: Project["extraction_config"];
  onChange: (config: ExportConfig) => void;
  hideHeader?: boolean;
};

const ARTICLE_FIELDS = [
  { label: "Title", value: "title" },
  { label: "URL", value: "url" },
  { label: "Summary", value: "summary" },
  { label: "Content", value: "content" },
  { label: "Created At", value: "created_at" },
  { label: "Status", value: "status" },
  { label: "Reviewed", value: "reviewed" },
];

export function ExportSettings({
  projectId,
  config,
  extractionConfig,
  onChange,
  hideHeader = false,
}: ExportSettingsProps) {
  const [fields, setFields] = useState<ExportField[]>(config?.fields || []);
  const [report, setReport] = useState(
    config?.report || {
      include_toc: true,
      header_text: "",
      footer_text: "",
      grouping: { enabled: false, field: "", show_empty: false },
      sections: [
        {
          id: "metadata",
          title: "Article Metadata",
          type: "metadata" as const,
          enabled: true,
        },
        {
          id: "summary",
          title: "Summary",
          type: "summary" as const,
          enabled: true,
        },
        {
          id: "entities",
          title: "Key Entities",
          type: "entities" as const,
          enabled: true,
        },
      ],
    },
  );

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const fetchPreview = async () => {
    if (!projectId) return;
    setIsLoadingPreview(true);
    try {
      // Send the current UNSAVED report state to the backend
      const data = await projectsApi.getReportPreview(projectId, report);
      setPreviewContent(data.markdown);
    } catch (err) {
      console.error("Preview failed", err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    setFields(config?.fields || []);
    if (config?.report) {
      setReport(config.report);
    }
  }, [config]);

  const handleUpdate = (updates: Partial<ExportConfig>) => {
    const next = { fields, report, ...updates };
    onChange(next);
  };

  const handleUpdateFields = (newFields: ExportField[]) => {
    setFields(newFields);
    handleUpdate({ fields: newFields });
  };

  const addField = () => {
    handleUpdateFields([
      ...fields,
      { key: "title", label: "Title", source: "article" },
    ]);
  };

  const removeField = (index: number) => {
    handleUpdateFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<ExportField>) => {
    const newFields = fields.map((f, i) =>
      i === index ? { ...f, ...updates } : f,
    );

    // If source changed, update key to first available option
    if (updates.source) {
      const source = updates.source;
      let firstKey = "";
      if (source === "article") firstKey = ARTICLE_FIELDS[0].value;
      else if (source === "annotations")
        firstKey = Object.keys(extractionConfig.entities || {})[0] || "";
      else if (source === "structured_data") {
        const firstStruct = extractionConfig.structures?.[0];
        firstKey = firstStruct
          ? `${firstStruct.name}.${firstStruct.fields[0]?.name}`
          : "";
      }
      newFields[index].key = firstKey;
      newFields[index].label = firstKey.split(".").pop() || "";
    }

    handleUpdateFields(newFields);
  };

  const getKeyOptions = (source: ExportField["source"]) => {
    if (source === "article") return ARTICLE_FIELDS;
    if (source === "annotations") {
      return Object.keys(extractionConfig.entities || {}).map((k) => ({
        label: k,
        value: k,
      }));
    }
    if (source === "structured_data") {
      const options: { label: string; value: string }[] = [];
      extractionConfig.structures?.forEach((s) => {
        s.fields.forEach((f) => {
          options.push({
            label: `${s.name}: ${f.name}`,
            value: `${s.name}.${f.name}`,
          });
        });
      });
      return options;
    }
    return [];
  };

  const handleUpdateReport = (updates: Partial<typeof report>) => {
    const next = { ...report, ...updates };
    setReport(next);
    handleUpdate({ report: next });
  };

  const updateReportSection = (
    index: number,
    updates: Partial<ReportSection>,
  ) => {
    const nextSections = report.sections.map((s, i) =>
      i === index ? { ...s, ...updates } : s,
    );
    handleUpdateReport({ sections: nextSections });
  };

  const addReportSection = (type: ReportSection["type"]) => {
    const nextId = `section-${Date.now()}`;
    const newSection: ReportSection = {
      id: nextId,
      title:
        type === "custom_text"
          ? "Custom Section"
          : type.charAt(0).toUpperCase() + type.slice(1),
      type,
      enabled: true,
      config: type === "custom_text" ? { text: "" } : {},
    };
    handleUpdateReport({ sections: [...report.sections, newSection] });
  };

  const removeReportSection = (index: number) => {
    handleUpdateReport({
      sections: report.sections.filter((_, i) => i !== index),
    });
  };

  const classificationOptions = useMemo(() => {
    const options: { label: string; value: string }[] = [
      { label: "No Grouping", value: "" },
    ];
    Object.keys(extractionConfig.classifications || {}).forEach((name) => {
      options.push({
        label: `Classification: ${name}`,
        value: `classification.${name}`,
      });
    });
    return options;
  }, [extractionConfig]);

  return (
    <div className="space-y-6 pb-20">
      {!hideHeader && (
        <div className="flex justify-between items-center mb-4">
          <EntityTitle
            title="Export Configuration"
            subtitle="Configure how project data is formatted for JSON, CSV, and PDF reports."
            heading={H3}
            icon="export"
          />
        </div>
      )}

      <Section
        title={
          <EntityTitle
            title="Tabular Data Fields"
            subtitle="Define the columns and keys for JSON and CSV exports."
            heading={H5}
          />
        }
        icon="th"
        collapsible={false}
        rightElement={
          <Button
            intent={Intent.PRIMARY}
            icon="plus"
            text="Add Field"
            onClick={addField}
            minimal
            small
          />
        }
      >
        <SectionCard padded={false}>
          {fields.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 dark:bg-bp-dark-surface border border-dashed border-gray-200 dark:border-bp-dark-border rounded text-gray-400 text-xs italic">
              No custom fields defined. Exports will use default article
              metadata.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              <div className="flex gap-4 font-bold text-[9px] uppercase tracking-wider text-gray-400 px-4 py-2 bg-gray-50/50 dark:bg-bp-dark-surface/50">
                <div className="w-48">Data Source</div>
                <div className="grow">Data Point</div>
                <div className="grow">Export Label</div>
                <div className="w-8"></div>
              </div>
              {fields.map((field, index) => (
                <div
                  key={index}
                  className="p-3 flex items-center gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="w-48">
                    <HTMLSelect
                      fill
                      minimal
                      value={field.source}
                      onChange={(e) =>
                        updateField(index, {
                          source: e.target.value as ExportField["source"],
                        })
                      }
                      options={[
                        { label: "Article Metadata", value: "article" },
                        { label: "Structured Data", value: "structured_data" },
                        { label: "Entity Annotations", value: "annotations" },
                      ]}
                    />
                  </div>
                  <div className="grow">
                    <HTMLSelect
                      fill
                      minimal
                      value={field.key}
                      onChange={(e) =>
                        updateField(index, { key: e.target.value })
                      }
                      options={getKeyOptions(field.source)}
                    />
                  </div>
                  <div className="grow">
                    <InputGroup
                      placeholder="Display Name"
                      value={field.label}
                      onChange={(e) =>
                        updateField(index, { label: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    icon="trash"
                    intent={Intent.DANGER}
                    minimal
                    small
                    onClick={() => removeField(index)}
                  />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </Section>

      <Section
        title={
          <EntityTitle
            title="Report Layout"
            subtitle="Configure global document structure and formatting."
            heading={H5}
          />
        }
        rightElement={
          projectId ? (
            <Button
              small
              icon="eye-open"
              text="Preview Report"
              onClick={() => {
                setIsPreviewOpen(true);
                fetchPreview();
              }}
            />
          ) : undefined
        }
        icon="document"
        collapsible={false}
      >
        <SectionCard className="p-4 space-y-6">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-tight mb-2">
                Document Options
              </div>
              <div className="space-y-3">
                <Switch
                  label="Include Table of Contents"
                  checked={report.include_toc}
                  onChange={(e) =>
                    handleUpdateReport({
                      include_toc: e.currentTarget.checked,
                    })
                  }
                />
                <Switch
                  label="Include Project Description"
                  checked={report.include_description !== false}
                  onChange={(e) =>
                    handleUpdateReport({
                      include_description: e.currentTarget.checked,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-tight mb-2">
                Header & Grouping
              </div>
              <FormGroup
                label={
                  <span className="text-xs text-gray-600">Header Title</span>
                }
                className="mb-0!"
                inline
              >
                <InputGroup
                  small
                  placeholder="e.g. OCHA Media Sweep"
                  value={report.header_text || ""}
                  onChange={(e) =>
                    handleUpdateReport({ header_text: e.target.value })
                  }
                />
              </FormGroup>
              <FormGroup
                label={<span className="text-xs text-gray-600">Grouping</span>}
                className="mb-0!"
                inline
              >
                <HTMLSelect
                  fill
                  minimal
                  className="text-xs"
                  value={report.grouping?.field || ""}
                  onChange={(e) =>
                    handleUpdateReport({
                      grouping: {
                        enabled: e.target.value !== "",
                        field: e.target.value,
                        show_empty: report.grouping?.show_empty,
                      },
                    })
                  }
                  options={classificationOptions}
                />
              </FormGroup>
            </div>
          </div>
        </SectionCard>
        <Section
          title="Article Content Template"
          subtitle="The order and formatting of sections for each article entry."
          collapsible={false}
          compact
          rightElement={
            <div className="flex gap-2">
              <Button
                small
                minimal
                icon="add"
                text="Add Data Section"
                intent={Intent.PRIMARY}
                onClick={() => addReportSection("metadata")}
              />
              <Button
                small
                minimal
                icon="plus"
                text="Custom Text"
                onClick={() => addReportSection("custom_text")}
              />
            </div>
          }
        >
          <SectionCard padded={false}>
            <div className="divide-y divide-gray-100">
              {report.sections.map((section, index) => (
                <div
                  key={section.id}
                  className={`p-3 flex items-start gap-4 transition-colors ${
                    section.enabled ? "bg-white dark:bg-bp-dark-bg" : "bg-gray-50/50 dark:bg-bp-dark-surface/50 opacity-60"
                  }`}
                >
                  <div className="flex flex-col pt-1">
                    <Button
                      minimal
                      small
                      icon="chevron-up"
                      disabled={index === 0}
                      onClick={() => {
                        const next = [...report.sections];
                        [next[index], next[index - 1]] = [
                          next[index - 1],
                          next[index],
                        ];
                        handleUpdateReport({ sections: next });
                      }}
                    />
                    <Button
                      minimal
                      small
                      icon="chevron-down"
                      disabled={index === report.sections.length - 1}
                      onClick={() => {
                        const next = [...report.sections];
                        [next[index], next[index + 1]] = [
                          next[index + 1],
                          next[index],
                        ];
                        handleUpdateReport({ sections: next });
                      }}
                    />
                  </div>

                  <div className="pt-2">
                    <Switch
                      checked={section.enabled}
                      onChange={(e) =>
                        updateReportSection(index, {
                          enabled: e.currentTarget.checked,
                        })
                      }
                    />
                  </div>

                  <div className="grow space-y-3 pt-1">
                    <div className="flex items-center gap-4">
                      <InputGroup
                        small
                        className="grow font-medium text-gray-800 dark:text-gray-100"
                        placeholder="Section Title"
                        value={section.title}
                        onChange={(e) =>
                          updateReportSection(index, {
                            title: e.target.value,
                          })
                        }
                        disabled={!section.enabled}
                      />
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                          Type:
                        </span>
                        <HTMLSelect
                          minimal
                          className="text-[11px] text-gray-600"
                          value={section.type}
                          onChange={(e) =>
                            updateReportSection(index, {
                              type: e.target.value as any,
                            })
                          }
                          options={[
                            { label: "Metadata", value: "metadata" },
                            { label: "Summary", value: "summary" },
                            { label: "Entities", value: "entities" },
                            { label: "Structured", value: "structured_data" },
                            { label: "Custom Text", value: "custom_text" },
                          ]}
                          disabled={!section.enabled}
                        />
                      </div>
                      <Button
                        icon="trash"
                        minimal
                        small
                        intent={Intent.DANGER}
                        className="opacity-40 hover:opacity-100 transition-opacity"
                        onClick={() => removeReportSection(index)}
                      />
                    </div>

                    {section.enabled && (
                      <div>
                        {section.type === "custom_text" ? (
                          <TextArea
                            fill
                            rows={2}
                            className="text-xs font-mono bg-gray-50/50 dark:bg-bp-dark-surface/50"
                            placeholder="Markdown content..."
                            value={section.config?.text || ""}
                            onChange={(e) =>
                              updateReportSection(index, {
                                config: {
                                  ...section.config,
                                  text: e.target.value,
                                },
                              })
                            }
                          />
                        ) : (
                          <div className="flex items-center gap-4">
                            <Checkbox
                              checked={section.config?.compact || false}
                              onChange={(e) =>
                                updateReportSection(index, {
                                  config: {
                                    ...section.config,
                                    compact: e.currentTarget.checked,
                                  },
                                })
                              }
                            >
                              <span className="text-xs text-gray-600">
                                Compact View
                              </span>
                            </Checkbox>
                            {section.type === "entities" && (
                              <Checkbox
                                checked={section.config?.show_labels || false}
                                onChange={(e) =>
                                  updateReportSection(index, {
                                    config: {
                                      ...section.config,
                                      show_labels: e.currentTarget.checked,
                                    },
                                  })
                                }
                              >
                                <span className="text-xs text-gray-600">
                                  Show Labels
                                </span>
                              </Checkbox>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {report.sections.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-xs italic">
                  No template sections defined.
                </div>
              )}
            </div>
          </SectionCard>
        </Section>
      </Section>
      <Section
        title={
          <EntityTitle
            title="Quick Templates"
            subtitle="Standardize your data exports with pre-defined configurations."
            heading={H5}
          />
        }
        icon="layout-auto"
        collapsible={true}
      >
        <SectionCard className="p-4 bg-gray-50/30 dark:bg-bp-dark-surface/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              text="Standard OCHA Metadata"
              icon="th-list"
              className="justify-start py-2"
              onClick={() =>
                handleUpdateFields([
                  { key: "title", label: "Title", source: "article" },
                  { key: "url", label: "URL", source: "article" },
                  { key: "summary", label: "Summary", source: "article" },
                  { key: "created_at", label: "Created At", source: "article" },
                ])
              }
            />
            <Button
              text="Entities Only (Flat)"
              icon="tag"
              className="justify-start py-2"
              onClick={() => {
                const entityFields: ExportField[] = Object.keys(
                  extractionConfig.entities || {},
                ).map((label) => ({
                  key: label,
                  label: label,
                  source: "annotations",
                }));
                handleUpdateFields(entityFields);
              }}
            />
          </div>
        </SectionCard>
      </Section>

      <Dialog
        title="Report Preview"
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        style={{ width: "900px" }}
      >
        <div className="p-0 flex flex-col h-[75vh]">
          <div className="grow overflow-auto bg-white dark:bg-bp-dark-bg p-10 border-b border-gray-200 dark:border-bp-dark-border">
            {isLoadingPreview ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Spinner size={32} />
                <p className="mt-4 text-gray-400 italic">
                  Generating report preview...
                </p>
              </div>
            ) : previewContent ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(previewContent) as string,
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 italic">
                No content generated.
              </div>
            )}
          </div>
          <div className="p-3 flex justify-between items-center bg-gray-50 dark:bg-bp-dark-surface rounded-b">
            <p className="text-[10px] text-gray-400 italic">
              * This preview uses your currently saved settings.
            </p>
            <div className="flex gap-2">
              <Button text="Close" onClick={() => setIsPreviewOpen(false)} />
              <Button
                intent={Intent.PRIMARY}
                icon="refresh"
                text="Refresh"
                loading={isLoadingPreview}
                onClick={fetchPreview}
              />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
