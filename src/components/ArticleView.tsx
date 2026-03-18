import {
  Alert,
  Button,
  Callout,
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
} from "@blueprintjs/core";
import { useEffect, useState } from "react";
import { articlesApi } from "../api";
import type { Annotation, Article, Project } from "../types";
import { Annotator } from "./Annotator";

type ArticleViewProps = {
  article: Article;
  labels: string[];
  extractionConfig?: Project["extraction_config"];
  onUpdate: (article: Article) => void;
  onRefresh: () => void;
  onDelete: () => void;
};

export function ArticleView({
  article,
  labels,
  extractionConfig,
  onUpdate,
  onRefresh,
  onDelete,
}: ArticleViewProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isReprocessAlertOpen, setIsReprocessAlertOpen] = useState(false);
  const [activeContentTab, setActiveContentTab] = useState<
    "annotator" | "list"
  >("annotator");

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

  const handleUpdateClassification = (name: string, value: string) => {
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
      [structName]: records,
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

  const structuredAnalysis: React.JSX.Element | null = (() => {
    if (!structures || structures.length === 0) return null;

    // Check if there is actually any structured data for the structures we have defined
    const hasData = structures.some(
      (s: { name: string }) => article.structured_data?.[s.name],
    );
    if (!hasData) return null;

    return (
      <Section title="Structured Analysis" icon="database" collapsible>
        <div className="space-y-6 p-4">
          {structures.map((struct) => {
            const rawData = article.structured_data?.[struct.name];
            const records = (Array.isArray(rawData)
              ? rawData
              : [rawData]) as Record<string, unknown>[];

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
                    <div className="p-8 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
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
                    records.map((data: Record<string, unknown>, idx: number) => (
                      <div
                        key={`${struct.name}-${idx}`}
                        className="bg-white border rounded-lg overflow-hidden shadow-sm transition-all"
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
                              ? "bg-green-50/30 border-green-100"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <span
                            className={`text-[10px] font-bold uppercase ${
                              isReviewMode ? "text-green-700" : "text-gray-500"
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
                                            {field.choices.map((c: string) => (
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
                                            ))}
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
                                    <span className="text-gray-900 font-medium">
                                      {field.dtype === "list" &&
                                      Array.isArray(val) ? (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {val.map((v: unknown, i: number) => (
                                            <Tag key={i} minimal round>
                                              {String(v)}
                                            </Tag>
                                          ))}
                                        </div>
                                      ) : (
                                        String(val)
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
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    );
  })();

  return (
    <div className="relative animate-[fade-in_0.3s_ease]">
      {/* Article Content */}
      <div className="mx-auto px-4 pt-4">
        <header className="mb-4 border-b border-gray-100">
          <div className="flex items-start gap-4 mb-3">
            <EntityTitle
              title={article.title}
              titleURL={article.url}
              heading={H3}
              ellipsize={false}
              className="text-gray-900 leading-tight tracking-tight flex-1"
            />
            <div className="flex shrink-0 gap-2">
              <Button
                minimal
                icon="trash"
                intent={Intent.DANGER}
                loading={isDeleting}
                text="Delete"
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
          <div className="p-12 rounded-lg text-center border border-dashed border-gray-300 bg-gray-50">
            <Icon
              icon="cloud-upload"
              size={40}
              className="mb-4 text-gray-400"
            />
            <H4>Ready for Processing</H4>
            <p className="text-gray-500 mb-6">
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
                  <span className="text-gray-500">
                    {article.processing_step ||
                      "Running GLiNER2 multi-capability extraction..."}
                  </span>
                </div>
              }
            />
          </div>
        )}

        {article.status === "completed" && (
          <div className="space-y-4">
            <Section title="Summary" icon="align-left" collapsible>
              <div className="p-4 text-gray-800 leading-relaxed bg-white rounded border border-gray-100">
                {article.summary}
              </div>
            </Section>

            {/* Classifications Section */}
            {Object.keys(classifications).length > 0 && (
              <Section title="Classifications" icon="list-columns" collapsible>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                  {Object.entries(classifications).map(([name, choices]) => {
                    const value = article.structured_data?.[name];
                    return (
                      <div
                        key={name}
                        className="p-3 bg-gray-50 rounded border transition-all"
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
                        <div className="text-sm font-semibold text-gray-800">
                          {isReviewMode ? (
                            <Popover
                              content={
                                <Menu>
                                  {(choices as string[]).map((choice) => (
                                    <MenuItem
                                      key={choice}
                                      text={choice}
                                      active={value === choice}
                                      onClick={() =>
                                        handleUpdateClassification(name, choice)
                                      }
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
                                text={String(value || "Select...")}
                                intent={value ? Intent.PRIMARY : Intent.NONE}
                                className="text-left flex justify-between"
                              />
                            </Popover>
                          ) : value ? (
                            <Tag
                              intent={Intent.PRIMARY}
                              minimal
                              large
                              className="w-full justify-center"
                            >
                              {String(value)}
                            </Tag>
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
            {structuredAnalysis as any}

            {/* Fallback for unknown keys in structured_data */}
            {article.structured_data &&
              Object.keys(article.structured_data).some(
                (k: string) =>
                  !classifications[k] &&
                  k !== "relation_extraction" &&
                  !structures.some((s: { name: string }) => s.name === k),
              ) && (
                <Section title="Other Extracted Data" icon="cube" collapsible>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
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
                          className="p-3 bg-gray-50 rounded border border-gray-200"
                        >
                          <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                            {key}
                          </span>
                          <div className="text-sm">
                            {typeof value === "object" ? (
                              <pre className="text-[10px] overflow-x-auto bg-white p-2 border border-gray-100 rounded mt-1">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            ) : (
                              <span className="font-medium text-gray-700">
                                {String(value)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </Section>
              )}

            {/* Relations Section */}
            {article.structured_data?.relation_extraction &&
              Object.keys(article.structured_data.relation_extraction).length >
                0 && (
                <Section title="Relations" icon="link" collapsible>
                  <div className="p-4 space-y-4">
                    {Object.entries(
                      article.structured_data.relation_extraction as Record<
                        string,
                        { head: { text: string }; tail: { text: string } }[]
                      >,
                    ).map(([relType, instances]) => (
                      <div key={relType} className="space-y-2">
                        <h6 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                          {relType}
                        </h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {instances.map((inst, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-100 rounded text-sm group hover:border-blue-200 transition-colors"
                            >
                              <div className="flex-1 flex flex-col">
                                <span className="text-[9px] text-gray-400 font-bold uppercase leading-none mb-1">
                                  SOURCE
                                </span>
                                <span className="font-medium text-gray-900">
                                  {inst.head.text}
                                </span>
                              </div>
                              <Icon
                                icon="arrow-right"
                                className="text-gray-300 group-hover:text-blue-400 transition-colors"
                              />
                              <div className="flex-1 flex flex-col">
                                <span className="text-[9px] text-gray-400 font-bold uppercase leading-none mb-1">
                                  TARGET
                                </span>
                                <span className="font-medium text-gray-900">
                                  {inst.tail.text}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

            <Section
              title="Content & Entities"
              icon="highlight"
              rightElement={
                <div className="flex items-center gap-4">
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
                  <div className="flex items-center gap-2 ml-2 border-l border-gray-200 pl-4">
                    <Tag minimal>
                      {article.annotations?.length || 0} Entities
                    </Tag>
                    {isProcessing && (
                      <span className="text-xs text-gray-500 italic">
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
                          <h6 className="text-xs font-bold uppercase text-gray-400 tracking-wider">
                            {label}
                          </h6>
                          <div className="flex flex-wrap gap-2">
                            {labelAnns.map((ann) => (
                              <Tag
                                key={ann.id}
                                round
                                minimal
                                interactive
                                className="px-3 py-1"
                              >
                                {article.content.slice(ann.start, ann.end)}
                              </Tag>
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
        <div className="sticky bottom-0 z-50 py-1.5 mt-8 border-t border-gray-300 bg-white">
          <div className="mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                icon={isReviewMode ? "small-cross" : "edit"}
                text={isReviewMode ? "Exit Review Mode" : "Review Mode"}
                active={isReviewMode}
                onClick={() => setIsReviewMode(!isReviewMode)}
                intent="success"
                className={`font-bold ${!isReviewMode ? "bg-white text-[#0f9960]" : ""}`}
              />
              {isReviewMode && (
                <div className="flex text-green-800 items-center gap-2 font-medium text-xs">
                  <Icon icon="info-sign" size={12} />
                  <span>Edits will mark this as Reviewed</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter leading-none mb-1">
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
