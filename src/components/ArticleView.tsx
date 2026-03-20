import {
  Alert,
  Button,
  Callout,
  Classes,
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
  Section,
  Spinner,
  Tab,
  Tabs,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import { useEffect, useMemo, useState } from "react";
import TimeAgo from "react-timeago";
import { articlesApi } from "../api";
import type { Annotation, Article, Project } from "../types";
import { Annotator, getProceduralColor } from "./Annotator";

type ArticleViewProps = {
  article: Article;
  labels: string[];
  extractionConfig?: Project["extraction_config"];
  onUpdate: (article: Article) => void;
  onRefresh: () => void;
  onDelete: () => void;
  onTogglePin?: (article: Article) => void;
};

export function ArticleView({
  article,
  labels,
  extractionConfig,
  onUpdate,
  onRefresh,
  onDelete,
  onTogglePin,
}: ArticleViewProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isReprocessAlertOpen, setIsReprocessAlertOpen] = useState(false);
  const [activeContentTab, setActiveContentTab] = useState<
    "annotator" | "list"
  >("annotator");

  // Section collapse states
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    summary: false,
    classifications: false,
    structured: false,
    other: false,
    relations: false,
    content: false,
  });

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const classifications = extractionConfig?.classifications || {};
  const structures = extractionConfig?.structures || [];

  // Track review mode exit to auto-save reviewed status
  useEffect(() => {
    if (!isReviewMode && hasChanges) {
      void articlesApi
        .update(article.id, { reviewed: true })
        .then((updated) => {
          onUpdate({ ...article, reviewed: updated.reviewed });
          setHasChanges(false);
        });
    }
  }, [isReviewMode, hasChanges, article, onUpdate]);

  // Reset hasChanges when article changes (selection changes)
  useEffect(() => {
    setHasChanges(false);
  }, [article.id]);

  // Fetch full article on mount if it's completed but doesn't have annotations
  useEffect(() => {
    if (
      article.status === "completed" &&
      (!article.annotations || article.annotations.length === 0)
    ) {
      void articlesApi.get(article.id).then((full) => onUpdate(full));
    }
  }, [article.id, article.status, article.annotations, onUpdate]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this article?")) return;
    try {
      setIsDeleting(true);
      await articlesApi.delete(article.id);
      onDelete();
    } catch (error) {
      console.error("Failed to delete article:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleProcess = async () => {
    if (article.reviewed) {
      setIsReprocessAlertOpen(true);
    } else {
      await executeProcess();
    }
  };

  const executeProcess = async () => {
    try {
      setIsProcessing(true);
      setIsReprocessAlertOpen(false);
      await articlesApi.process(article.id);
      onRefresh();
    } catch (error) {
      console.error("Failed to process article:", error);
      setIsProcessing(false);
    }
  };

  // Polling for processing updates
  useEffect(() => {
    let interval: number | undefined;
    if (article.status === "processing" || isProcessing) {
      interval = window.setInterval(async () => {
        try {
          const updated = await articlesApi.get(article.id);
          onUpdate(updated);
          if (updated.status === "completed" || updated.status === "error") {
            clearInterval(interval);
            setIsProcessing(false);
          }
        } catch {
          clearInterval(interval);
          setIsProcessing(false);
        }
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [article.status, isProcessing, article.id, onUpdate]);

  const handleAnnotationChange = async (newAnnotations: Annotation[]) => {
    try {
      await articlesApi.updateAnnotations(article.id, newAnnotations);
      setHasChanges(true);
      onUpdate({ ...article, annotations: newAnnotations });
    } catch (error) {
      console.error("Failed to update annotations:", error);
    }
  };

  const updateStructuredData = async (newData: Record<string, unknown>) => {
    try {
      const updated = await articlesApi.update(article.id, {
        structured_data: newData,
      });
      setHasChanges(true);
      onUpdate({ ...article, structured_data: updated.structured_data });
    } catch (error) {
      console.error("Failed to update structured data:", error);
    }
  };

  const handleUpdateClassification = (
    name: string,
    value: string | string[],
  ) => {
    const next = { ...article.structured_data, [name]: value };
    void updateStructuredData(next);
  };

  const handleUpdateField = (
    structName: string,
    fieldName: string,
    value: unknown,
    recordIndex: number = 0,
  ) => {
    const rawData = article.structured_data?.[structName];
    const records = Array.isArray(rawData) ? [...rawData] : [rawData || {}];

    const targetRecord = { ...(records[recordIndex] || {}) } as Record<
      string,
      unknown
    >;
    targetRecord[fieldName] = value;
    records[recordIndex] = targetRecord;

    const nextData = {
      ...article.structured_data,
      [structName]: Array.isArray(rawData) ? records : records[0],
    };
    void updateStructuredData(nextData);
  };

  const handleAddRecord = (structName: string) => {
    const rawData = article.structured_data?.[structName];
    const records = Array.isArray(rawData) ? [...rawData] : [rawData || {}];

    // Create an empty record
    records.push({});

    const nextData = {
      ...article.structured_data,
      [structName]: Array.isArray(rawData) ? records : records[0],
    };
    void updateStructuredData(nextData);
  };

  const handleDeleteRecord = (structName: string, index: number) => {
    const rawData = article.structured_data?.[structName];
    if (!Array.isArray(rawData)) {
      // If it's not an array, just clear it
      const nextData = { ...article.structured_data };
      delete nextData[structName];
      void updateStructuredData(nextData);
      return;
    }

    const nextRecords = rawData.filter((_, i) => i !== index);
    const nextData = {
      ...article.structured_data,
      [structName]: nextRecords.length > 0 ? nextRecords : undefined,
    };
    if (!nextData[structName]) delete nextData[structName];

    void updateStructuredData(nextData);
  };

  const handleUpdateRelation = (
    relType: string,
    index: number,
    field: "head" | "tail",
    value: string,
  ) => {
    const nextRelations = {
      ...(article.structured_data?.relation_extraction || {}),
    } as Record<string, any[]>;
    const instances = [...(nextRelations[relType] || [])];
    const current = { ...(instances[index] || {}) };

    if (typeof current[field] === "object") {
      current[field] = { ...current[field], text: value };
    } else {
      current[field] = { text: value };
    }

    instances[index] = current;
    nextRelations[relType] = instances;

    void updateStructuredData({
      ...article.structured_data,
      relation_extraction: nextRelations,
    });
  };

  const handleDeleteRelationInstance = (relType: string, index: number) => {
    const nextRelations = {
      ...(article.structured_data?.relation_extraction || {}),
    } as Record<string, any[]>;
    const instances = (nextRelations[relType] || []).filter(
      (_, i) => i !== index,
    );

    if (instances.length > 0) {
      nextRelations[relType] = instances;
    } else {
      delete nextRelations[relType];
    }

    void updateStructuredData({
      ...article.structured_data,
      relation_extraction: nextRelations,
    });
  };

  const handleAddRelationInstance = (relType: string) => {
    const nextRelations = {
      ...(article.structured_data?.relation_extraction || {}),
    } as Record<string, any[]>;
    const instances = [...(nextRelations[relType] || [])];

    instances.push({
      head: { text: "" },
      tail: { text: "" },
    });

    nextRelations[relType] = instances;

    void updateStructuredData({
      ...article.structured_data,
      relation_extraction: nextRelations,
    });
  };

  const getDisplayText = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      return String(obj.label || obj.text || "");
    }
    return String(val);
  };

  const renderValueWithConfidence = (val: unknown) => {
    if (val === null || val === undefined) return null;

    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      const confidence = obj.confidence as number | undefined;
      const label = (obj.label || obj.text) as string | undefined;

      if (confidence !== undefined && label !== undefined) {
        const isLow = confidence < 0.3;
        return (
          <Tooltip
            content={`${Math.round(confidence * 100)}% confidence`}
            placement="top"
          >
            <span
              className={`cursor-help border-b border-dotted ${
                isLow
                  ? "border-orange-500 text-orange-600 font-bold"
                  : "border-gray-400"
              }`}
            >
              {String(label)}
            </span>
          </Tooltip>
        );
      }
    }

    return String(val);
  };

  const structuredAnalysis = useMemo(() => {
    if (!structures || structures.length === 0) return null;

    // Check if there is actually any structured data for the structures we have defined
    const hasData = structures.some(
      (s: { name: string }) => article.structured_data?.[s.name],
    );
    if (!hasData) return null;

    return (
      <Section
        title="Structured Analysis"
        icon="database"
        collapsible
        collapseProps={{
          isOpen: !collapsed.structured,
          onToggle: () => toggleCollapse("structured"),
        }}
        className="flex flex-col"
      >
        <div className="space-y-6 p-4 h-full">
          {structures.map((struct) => {
            const rawData = article.structured_data?.[struct.name];
            const records = (
              Array.isArray(rawData) ? rawData : [rawData]
            ) as Record<string, unknown>[];

            if (!rawData) return null;

            return (
              <div key={struct.name} className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {struct.name}
                    </span>
                    {records.length > 1 && (
                      <Tag minimal round>
                        {records.length} records
                      </Tag>
                    )}
                  </div>
                  {isReviewMode && (
                    <Button
                      small
                      minimal
                      intent={Intent.SUCCESS}
                      icon="plus"
                      text="Add Record"
                      onClick={() => handleAddRecord(struct.name)}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {(!rawData || records.length === 0) && isReviewMode ? (
                    <div className="p-8 text-center border border-dashed border-gray-200 dark:border-bp-dark-border rounded-lg bg-gray-50/50 dark:bg-bp-dark-surface/50">
                      <p className="text-gray-400 text-sm mb-2">
                        No records for {struct.name}
                      </p>
                      <Button
                        small
                        minimal
                        intent={Intent.SUCCESS}
                        icon="plus"
                        text="Add Record"
                        onClick={() => handleAddRecord(struct.name)}
                      />
                    </div>
                  ) : !rawData ? null : (
                    records.map(
                      (data: Record<string, unknown>, idx: number) => (
                        <div
                          key={`${struct.name}-${idx}`}
                          className="bg-white dark:bg-bp-dark-bg border rounded-lg overflow-hidden shadow-sm transition-all"
                          style={{
                            borderColor: isReviewMode ? "#0f9960" : "#e1e8ed",
                            borderWidth: isReviewMode ? "4px" : "1px",
                            boxShadow: isReviewMode
                              ? "0 2px 8px rgba(15, 153, 96, 0.15)"
                              : "none",
                          }}
                        >
                          <div
                            className={`px-3 py-1.5 border-b flex items-center justify-between ${
                              isReviewMode
                                ? "bg-green-50/30 dark:bg-green-900/20 border-green-100 dark:border-green-900/50"
                                : "bg-gray-50 dark:bg-bp-dark-surface border-gray-200 dark:border-bp-dark-border"
                            }`}
                          >
                            <span
                              className={`text-[10px] font-bold uppercase ${
                                isReviewMode
                                  ? "text-green-700"
                                  : "text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              Record #{idx + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              {isReviewMode && (
                                <Button
                                  small
                                  minimal
                                  icon="trash"
                                  intent={Intent.DANGER}
                                  onClick={() =>
                                    handleDeleteRecord(struct.name, idx)
                                  }
                                  title="Delete this record"
                                />
                              )}
                              {data && !isReviewMode && (
                                <Icon
                                  icon="tick-circle"
                                  intent={Intent.SUCCESS}
                                  size={12}
                                />
                              )}
                            </div>
                          </div>
                          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                            {struct.fields.map((field) => {
                              const rawVal = data?.[field.name];
                              const val =
                                rawVal &&
                                typeof rawVal === "object" &&
                                "text" in rawVal
                                  ? (rawVal as { text: string }).text
                                  : rawVal;

                              return (
                                <div
                                  key={field.name}
                                  className="flex flex-col p-1 rounded transition-colors"
                                  style={{
                                    background: isReviewMode
                                      ? "rgba(15, 153, 96, 0.05)"
                                      : "transparent",
                                    boxShadow: isReviewMode
                                      ? "inset 0 0 0 1px rgba(15, 153, 96, 0.15)"
                                      : "none",
                                  }}
                                >
                                  <span className="text-[10px] font-medium text-gray-400 mb-0.5">
                                    {field.name}
                                  </span>
                                  <div className="text-sm">
                                    {isReviewMode ? (
                                      field.choices ? (
                                        <Popover
                                          content={
                                            <Menu>
                                              {field.choices.map(
                                                (c: string) => (
                                                  <MenuItem
                                                    key={c}
                                                    text={c}
                                                    active={val === c}
                                                    onClick={() =>
                                                      handleUpdateField(
                                                        struct.name,
                                                        field.name,
                                                        c,
                                                        idx,
                                                      )
                                                    }
                                                  />
                                                ),
                                              )}
                                            </Menu>
                                          }
                                          position="bottom"
                                        >
                                          <Button
                                            rightIcon="caret-down"
                                            minimal
                                            small
                                            text={String(val || "Select...")}
                                          />
                                        </Popover>
                                      ) : (
                                        <InputGroup
                                          asyncControl
                                          small
                                          fill
                                          placeholder="Empty"
                                          value={String(val || "")}
                                          onChange={(e) =>
                                            handleUpdateField(
                                              struct.name,
                                              field.name,
                                              e.target.value,
                                              idx,
                                            )
                                          }
                                        />
                                      )
                                    ) : val !== undefined && val !== null ? (
                                      <span className="text-gray-900 dark:text-white font-medium">
                                        {field.dtype === "list" &&
                                        Array.isArray(val) ? (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {val.map(
                                              (v: unknown, i: number) => (
                                                <Tag key={i} minimal round>
                                                  {renderValueWithConfidence(v)}
                                                </Tag>
                                              ),
                                            )}
                                          </div>
                                        ) : (
                                          renderValueWithConfidence(val)
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300 italic text-xs">
                                        Empty
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    );
  }, [
    structures,
    article.structured_data,
    isReviewMode,
    collapsed.structured,
    toggleCollapse,
  ]);

  return (
    <div className="relative animate-[fade-in_0.3s_ease] @container">
      {/* Article Content */}
      <div className="mx-auto px-4 pt-4">
        <header className="mb-4 border-b border-gray-100 dark:border-bp-dark-border pb-1">
          <div className="flex items-start gap-4 mb-2">
            <div className="flex-1">
              <EntityTitle
                title={article.title}
                titleURL={article.url}
                heading={H3}
                ellipsize={false}
                className="text-gray-900 dark:text-white leading-tight tracking-tight mb-1"
              />
              <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Icon icon="time" size={12} />
                  <span>
                    Collected <TimeAgo date={article.created_at} />
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon icon="link" size={12} />
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-blue-500"
                  >
                    {new URL(article.url).hostname}
                  </a>
                </div>
                {article.reviewed && (
                  <Tag intent={Intent.SUCCESS} minimal round icon="tick-circle">
                    Verified
                  </Tag>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                minimal
                icon="trash"
                intent={Intent.DANGER}
                loading={isDeleting}
                onClick={handleDelete}
              />
              <Button
                intent={Intent.PRIMARY}
                icon="refresh"
                loading={isProcessing || article.status === "processing"}
                text="Reprocess"
                onClick={handleProcess}
              />
            </div>
          </div>
        </header>

        <Alert
          isOpen={isReprocessAlertOpen}
          onCancel={() => setIsReprocessAlertOpen(false)}
          onConfirm={executeProcess}
          cancelButtonText="Cancel"
          confirmButtonText="Reprocess Anyway"
          intent={Intent.DANGER}
          icon="warning-sign"
        >
          <p>
            This article has already been <strong>Reviewed</strong>.
            Reprocessing will overwrite your manual corrections and the review
            status.
          </p>
          <p>Are you sure you want to continue?</p>
        </Alert>

        {article.status === "pending" && !isProcessing && (
          <div className="p-12 rounded-lg text-center border border-dashed border-gray-300 dark:border-[#5e6064] bg-gray-50 dark:bg-bp-dark-surface">
            <Icon
              icon="cloud-upload"
              size={40}
              className="mb-4 text-gray-400"
            />
            <H4>Ready for Processing</H4>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Click the button to extract content, summary and entities using
              GLiNER2 and ReadabilityJS.
            </p>
            <Button
              large
              intent={Intent.PRIMARY}
              icon="play"
              text="Extract Content & Entities"
              onClick={handleProcess}
            />
          </div>
        )}

        {(isProcessing || article.status === "processing") && (
          <div className="py-24">
            <NonIdealState
              icon={<Spinner intent={Intent.PRIMARY} size={48} />}
              title="Ingesting Article"
              description={
                <div className="flex flex-col items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400">
                    {article.processing_step ||
                      "Running GLiNER2 multi-capability extraction..."}
                  </span>
                </div>
              }
            />
          </div>
        )}

        {article.status === "completed" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 @xl:grid-cols-3 gap-6">
              {/* Left Column: Summary, Classifications, Structured Analysis */}
              <div className="@xl:col-span-2 flex flex-col gap-6">
                <Section
                  title="Summary"
                  icon="align-left"
                  collapsible
                  collapseProps={{
                    isOpen: !collapsed.summary,
                    onToggle: () => toggleCollapse("summary"),
                  }}
                  className="flex flex-col"
                >
                  <div className="p-4 text-gray-800 dark:text-gray-100 leading-relaxed">
                    {article.summary}
                  </div>
                </Section>

                {/* Classifications Section */}
                {Object.keys(classifications).length > 0 && (
                  <Section
                    title="Classifications"
                    icon="list-columns"
                    collapsible
                    collapseProps={{
                      isOpen: !collapsed.classifications,
                      onToggle: () => toggleCollapse("classifications"),
                    }}
                    className="flex flex-col"
                  >
                    <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 p-4 h-full">
                      {Object.entries(classifications).map(([name, config]) => {
                        const value = article.structured_data?.[name];
                        const choices = Array.isArray(config)
                          ? config
                          : Array.isArray(config.labels)
                            ? config.labels
                            : Object.keys(config.labels);

                        return (
                          <div
                            key={name}
                            className="p-3 bg-gray-50 dark:bg-bp-dark-surface rounded border transition-all"
                            style={{
                              borderColor: isReviewMode ? "#0f9960" : "#e1e8ed",
                              borderWidth: isReviewMode ? "4px" : "1px",
                              boxShadow: isReviewMode
                                ? "0 2px 4px rgba(15, 153, 96, 0.1)"
                                : "none",
                            }}
                          >
                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                              {name}
                            </span>
                            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                              {isReviewMode ? (
                                <Popover
                                  content={
                                    <Menu>
                                      {choices.map((choice) => (
                                        <MenuItem
                                          key={choice}
                                          text={choice}
                                          active={
                                            Array.isArray(value)
                                              ? value.includes(choice)
                                              : value === choice
                                          }
                                          onClick={() => {
                                            if (
                                              !Array.isArray(config) &&
                                              config.multi_label
                                            ) {
                                              const current = Array.isArray(
                                                value,
                                              )
                                                ? (value as string[])
                                                : value
                                                  ? [String(value)]
                                                  : [];
                                              const next = current.includes(
                                                choice,
                                              )
                                                ? current.filter(
                                                    (c) => c !== choice,
                                                  )
                                                : [...current, choice];
                                              handleUpdateClassification(
                                                name,
                                                next,
                                              );
                                            } else {
                                              handleUpdateClassification(
                                                name,
                                                choice,
                                              );
                                            }
                                          }}
                                        />
                                      ))}
                                    </Menu>
                                  }
                                  position="bottom"
                                  fill
                                >
                                  <Button
                                    rightIcon="caret-down"
                                    minimal
                                    small
                                    fill
                                    text={
                                      Array.isArray(value)
                                        ? value
                                            .map(getDisplayText)
                                            .join(", ") || "Select..."
                                        : getDisplayText(value) || "Select..."
                                    }
                                    intent={
                                      value ? Intent.PRIMARY : Intent.NONE
                                    }
                                    className="text-left flex justify-between"
                                  />
                                </Popover>
                              ) : value ? (
                                <div className="flex flex-wrap gap-1">
                                  {(Array.isArray(value) ? value : [value]).map(
                                    (v) => (
                                      <Tag
                                        key={String(v)}
                                        intent={Intent.PRIMARY}
                                        minimal
                                        large
                                        className="grow justify-center"
                                      >
                                        {renderValueWithConfidence(v)}
                                      </Tag>
                                    ),
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-300 italic">
                                  No match found
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                )}

                {/* Structured Data Section */}
                {structuredAnalysis && (
                  <div className="flex flex-col">{structuredAnalysis}</div>
                )}

                {/* Fallback for unknown keys in structured_data */}
                {article.structured_data &&
                  Object.keys(article.structured_data).some(
                    (k: string) =>
                      !classifications[k] &&
                      k !== "relation_extraction" &&
                      !structures.some((s: { name: string }) => s.name === k),
                  ) && (
                    <Section
                      title="Other Extracted Data"
                      icon="cube"
                      collapsible
                      collapseProps={{
                        isOpen: !collapsed.other,
                        onToggle: () => toggleCollapse("other"),
                      }}
                      className="flex flex-col"
                    >
                      <div className="grid grid-cols-1 @md:grid-cols-2 gap-4 p-4 h-full bg-white dark:bg-bp-dark-bg rounded border border-gray-100 dark:border-bp-dark-border">
                        {Object.entries(article.structured_data)
                          .filter(
                            ([k]: [string, unknown]) =>
                              !classifications[k] &&
                              k !== "relation_extraction" &&
                              !structures.some(
                                (s: { name: string }) => s.name === k,
                              ),
                          )
                          .map(([key, value]: [string, unknown]) => (
                            <div
                              key={key}
                              className="p-3 bg-gray-50 dark:bg-bp-dark-surface rounded border border-gray-200 dark:border-bp-dark-border"
                            >
                              <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                                {key}
                              </span>
                              <div className="text-sm">
                                {typeof value === "object" &&
                                value !== null &&
                                !("label" in value) &&
                                !("text" in value) ? (
                                  <pre className="text-[10px] overflow-x-auto bg-white dark:bg-bp-dark-bg p-2 border border-gray-100 dark:border-bp-dark-border rounded mt-1">
                                    {JSON.stringify(value, null, 2)}
                                  </pre>
                                ) : (
                                  <span className="font-medium text-gray-700 dark:text-gray-200">
                                    {renderValueWithConfidence(value)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </Section>
                  )}
              </div>

              {/* Right Column: Relations */}
              <div className="@xl:col-span-1 flex flex-col gap-6">
                {(() => {
                  const relations = (article.structured_data
                    ?.relation_extraction || {}) as Record<
                    string,
                    {
                      head: { text: string; confidence?: number };
                      tail: { text: string; confidence?: number };
                    }[]
                  >;

                  // Get predefined relation types from config, plus any existing ones
                  const definedRelTypes = Object.keys(
                    extractionConfig?.relations || {},
                  );
                  const existingRelTypes = Object.keys(relations);
                  const allRelTypes = Array.from(
                    new Set([...definedRelTypes, ...existingRelTypes]),
                  );

                  const activeRelations = Object.entries(relations).filter(
                    ([_, instances]) => instances.length > 0,
                  );

                  if (activeRelations.length === 0 && !isReviewMode)
                    return null;

                  return (
                    <Section
                      title="Relations"
                      icon="link"
                      collapsible
                      collapseProps={{
                        isOpen: !collapsed.relations,
                        onToggle: () => toggleCollapse("relations"),
                      }}
                      className="flex flex-col"
                      rightElement={
                        isReviewMode && allRelTypes.length > 0 ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Popover
                              content={
                                <Menu>
                                  <li className={Classes.MENU_HEADER}>
                                    <h6 className={Classes.HEADING}>
                                      Add Relation Instance
                                    </h6>
                                  </li>
                                  {allRelTypes.map((type) => (
                                    <MenuItem
                                      key={type}
                                      text={type}
                                      icon="plus"
                                      onClick={() =>
                                        handleAddRelationInstance(type)
                                      }
                                    />
                                  ))}
                                </Menu>
                              }
                              position="bottom"
                            >
                              <Button
                                small
                                minimal
                                icon="plus"
                                text="Add"
                              />
                            </Popover>
                          </div>
                        ) : undefined
                      }
                    >
                      <div className="p-4 space-y-6 h-full bg-white dark:bg-bp-dark-bg rounded border border-gray-100 dark:border-bp-dark-border">
                        {activeRelations.length === 0 && (
                          <NonIdealState
                            icon="graph"
                            title="No Relations"
                            description="No semantic relations were extracted for this article."
                            className="p-4"
                          />
                        )}
                        {activeRelations.map(([relType, instances]) => (
                          <div key={relType} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h6 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                                {relType}
                              </h6>
                              {isReviewMode && (
                                <Button
                                  small
                                  minimal
                                  icon="plus"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddRelationInstance(relType);
                                  }}
                                  title={`Add ${relType} instance`}
                                />
                              )}
                            </div>
                            <div className="space-y-2">
                              {instances.map((inst, idx) => (
                                <div
                                  key={idx}
                                  className="relative flex flex-col gap-2 p-3 bg-gray-50 dark:bg-bp-dark-surface border border-gray-100 dark:border-bp-dark-border rounded text-sm group hover:border-blue-200 transition-colors"
                                  style={{
                                    borderColor: isReviewMode
                                      ? "#0f9960"
                                      : undefined,
                                    borderWidth: isReviewMode ? "2px" : "1px",
                                  }}
                                >
                                  {isReviewMode && (
                                    <Button
                                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                      small
                                      minimal
                                      icon="trash"
                                      intent={Intent.DANGER}
                                      onClick={() =>
                                        handleDeleteRelationInstance(
                                          relType,
                                          idx,
                                        )
                                      }
                                    />
                                  )}
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-gray-400 font-bold uppercase leading-none mb-1">
                                      SOURCE
                                    </span>
                                    {isReviewMode ? (
                                      <InputGroup
                                        small
                                        fill
                                        placeholder="Source text..."
                                        value={getDisplayText(inst.head)}
                                        onChange={(e) =>
                                          handleUpdateRelation(
                                            relType,
                                            idx,
                                            "head",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    ) : (
                                      <span className="font-medium text-gray-900 dark:text-white">
                                        {renderValueWithConfidence(inst.head)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Icon
                                      icon="arrow-down"
                                      className="text-gray-300 group-hover:text-blue-400 transition-colors"
                                      size={12}
                                    />
                                    <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter">
                                      {relType}
                                    </span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-gray-400 font-bold uppercase leading-none mb-1">
                                      TARGET
                                    </span>
                                    {isReviewMode ? (
                                      <InputGroup
                                        small
                                        fill
                                        placeholder="Target text..."
                                        value={getDisplayText(inst.tail)}
                                        onChange={(e) =>
                                          handleUpdateRelation(
                                            relType,
                                            idx,
                                            "tail",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    ) : (
                                      <span className="font-medium text-gray-900 dark:text-white">
                                        {renderValueWithConfidence(inst.tail)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  );
                })()}
              </div>
            </div>

            <Section
              title="Content & Entities"
              icon="highlight"
              collapsible
              collapseProps={{
                isOpen: !collapsed.content,
                onToggle: () => toggleCollapse("content"),
              }}
              rightElement={
                <div 
                  className="flex items-center gap-4" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <Tabs
                    id="ArticleContentViewTabs"
                    selectedTabId={activeContentTab}
                    onChange={(id) =>
                      setActiveContentTab(id as "annotator" | "list")
                    }
                  >
                    <Tab id="annotator" title="Annotator" icon="highlight" />
                    <Tab id="list" title="List View" icon="th-list" />
                  </Tabs>
                  <div className="flex items-center gap-2 ml-2 border-l border-gray-200 dark:border-bp-dark-border pl-4">
                    <Tag minimal>
                      {article.annotations?.length || 0} Entities
                    </Tag>
                    {isProcessing && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                        Polling...
                      </span>
                    )}
                    <Button
                      small
                      minimal
                      icon="refresh"
                      onClick={onRefresh}
                      title="Force Refresh Article Data"
                    />
                  </div>
                </div>
              }
            >
              <div
                className="p-4 transition-all"
                style={{
                  background:
                    isReviewMode && activeContentTab === "annotator"
                      ? "rgba(15, 153, 96, 0.02)"
                      : "transparent",
                  borderStyle: "solid",
                  borderWidth:
                    isReviewMode && activeContentTab === "annotator"
                      ? "4px"
                      : "0px",
                  borderColor: "#0f9960",
                }}
              >
                {activeContentTab === "annotator" ? (
                  <Annotator
                    articleId={article.id}
                    text={article.content}
                    initialAnnotations={article.annotations}
                    initialLabels={labels}
                    onChange={handleAnnotationChange}
                    isEditable={isReviewMode}
                  />
                ) : (
                  <div className="space-y-6">
                    {labels.map((label) => {
                      const labelAnns = (article.annotations || [])
                        .filter((a) => a.label === label)
                        .sort((a, b) => a.start - b.start);

                      if (labelAnns.length === 0) return null;

                      return (
                        <div key={label} className="space-y-2">
                          <h6
                            className="text-xs font-bold uppercase tracking-wider"
                            style={{
                              color: getProceduralColor(label, labels).solid,
                            }}
                          >
                            {label}
                          </h6>
                          <div className="flex flex-wrap gap-2">
                            {labelAnns.map((ann) => (
                              <Tooltip
                                key={ann.id}
                                content={
                                  ann.confidence
                                    ? `Confidence: ${(
                                        ann.confidence * 100
                                      ).toFixed(1)}%`
                                    : "Manual annotation"
                                }
                              >
                                <Tag
                                  round
                                  minimal
                                  interactive
                                  className="px-3 py-1"
                                >
                                  {article.content.slice(ann.start, ann.end)}
                                </Tag>
                              </Tooltip>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}

        {article.status === "error" && (
          <Callout intent={Intent.DANGER} title="Processing Error">
            {article.error_message ||
              "An unknown error occurred while processing this article."}
          </Callout>
        )}
      </div>

      {/* Sticky Review Bar */}
      {article.status === "completed" && (
        <div className="sticky bottom-0 z-50 py-1.5 mt-8 border-t border-gray-300 dark:border-[#5e6064] bg-white dark:bg-bp-dark-bg">
          <div className="mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                icon={isReviewMode ? "small-cross" : "edit"}
                text={isReviewMode ? "Exit Review Mode" : "Review Mode"}
                active={isReviewMode}
                onClick={() => setIsReviewMode(!isReviewMode)}
                intent="success"
                className={`font-bold ${!isReviewMode ? "bg-white dark:bg-bp-dark-bg text-[#0f9960]" : ""}`}
                size="small"
              />
              <Button
                icon={article.pinned ? "star" : "star-empty"}
                text={article.pinned ? "Pinned to Report" : "Pin to Report"}
                active={article.pinned}
                onClick={() => onTogglePin?.(article)}
                intent={article.pinned ? Intent.PRIMARY : Intent.NONE}
                className="font-bold"
                size="small"
              />
              {isReviewMode && (
                <div className="flex text-green-800 items-center gap-2 font-medium text-xs">
                  <Icon icon="info-sign" size={12} />
                  <span>Edits will mark this as Reviewed</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 border-r border-gray-200 dark:border-bp-dark-border pr-4 mr-1">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                  NAVIGATE
                </span>
                <div className="flex gap-1">
                  <Tag minimal className="font-mono font-bold text-[10px] px-1.5 min-w-0">
                    <Icon icon="arrow-left" size={10} />
                  </Tag>
                  <Tag minimal className="font-mono font-bold text-[10px] px-1.5 min-w-0">
                    <Icon icon="arrow-right" size={10} />
                  </Tag>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-tighter leading-none mb-1">
                  ARTICLE STATUS
                </span>
                <div className="font-bold leading-none">
                  {article.reviewed ? (
                    <span className="text-green-800 flex items-center gap-1 text-xs">
                      <Icon icon="tick-circle" size={12} /> Reviewed
                    </span>
                  ) : (
                    <span className="text-yellow-600 text-xs flex items-center gap-1 font-medium">
                      <Icon icon="time" size={12} /> Awaiting Review
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
