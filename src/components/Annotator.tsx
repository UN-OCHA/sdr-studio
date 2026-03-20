import {
  Button,
  Classes,
  Icon,
  Intent,
  Menu,
  MenuItem,
  Popover,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { getProceduralColor } from "../colorUtils";
import { type Annotation } from "../types";

type PendingSelection = {
  start: number;
  end: number;
  text: string;
};

type BulkSuggestion = {
  label: string;
  text: string;
  matches: { start: number; end: number }[];
};

type AnnotatorProps = {
  articleId: string;
  text: string;
  initialAnnotations?: Annotation[];
  initialLabels?:
    | string[]
    | Record<
        string,
        | string
        | { description: string; threshold?: number; dtype?: "str" | "list" }
      >;
  onChange?: (annotations: Annotation[]) => void;
  isEditable?: boolean;
};

function snapToWordBoundary(fullText: string, start: number, end: number) {
  let snapStart = start;
  let snapEnd = end;
  const isWordChar = (char: string) => /[a-zA-Z0-9\u00C0-\u024F]/.test(char);

  while (snapStart > 0 && isWordChar(fullText[snapStart - 1])) snapStart--;
  while (snapEnd < fullText.length && isWordChar(fullText[snapEnd])) snapEnd++;
  while (snapStart < snapEnd && /\s/.test(fullText[snapStart])) snapStart++;
  while (snapEnd > snapStart && /\s/.test(fullText[snapEnd - 1])) snapEnd--;

  return {
    start: snapStart,
    end: snapEnd,
    text: fullText.slice(snapStart, snapEnd),
  };
}

function getSelectionOffsets() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
    return null;

  const range = selection.getRangeAt(0);

  function getAbsolutePosition(node: Node, offset: number) {
    const element =
      node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    const target = element?.closest("[data-start]");
    if (!target) return null;
    const base = parseInt(target.getAttribute("data-start") || "0", 10);
    return node.nodeType === Node.TEXT_NODE ? base + offset : base;
  }

  const start = getAbsolutePosition(range.startContainer, range.startOffset);
  const end = getAbsolutePosition(range.endContainer, range.endOffset);

  if (start === null || end === null) return null;

  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function Annotator({
  articleId,
  text,
  initialAnnotations = [],
  initialLabels = ["Person", "Organization", "Location", "Concept", "Date"],
  onChange,
  isEditable = true,
}: AnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [annotations, setAnnotations] = useState<Annotation[]>(
    initialAnnotations || [],
  );

  const getLabelList = useCallback((raw: AnnotatorProps["initialLabels"]) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return Object.keys(raw);
  }, []);

  const [availableLabels, setAvailableLabels] = useState<string[]>(
    getLabelList(initialLabels),
  );

  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(
    null,
  );

  const [bulkSuggestion, setBulkSuggestion] = useState<BulkSuggestion | null>(
    null,
  );
  const [activeModeLabel, setActiveModeLabel] = useState<string | null>(null);

  const [history, setHistory] = useState<Annotation[][]>([
    initialAnnotations || [],
  ]);
  const [historyStep, setHistoryStep] = useState(0);

  // Reset internal state when article changes or initialAnnotations is updated
  useEffect(() => {
    setAnnotations(initialAnnotations || []);
    setHistory([initialAnnotations || []]);
    setHistoryStep(0);
  }, [initialAnnotations, articleId]);

  useEffect(() => {
    setAvailableLabels(getLabelList(initialLabels));
  }, [initialLabels, getLabelList]);

  const updateAnnotations = useCallback(
    (updater: (prev: Annotation[]) => Annotation[]) => {
      setAnnotations((prev) => {
        const next = updater(prev);

        setHistory((h) => {
          const newHistory = h.slice(0, historyStep + 1);
          newHistory.push(next);
          return newHistory;
        });
        setHistoryStep((s) => s + 1);

        onChange?.(next);
        return next;
      });
    },
    [historyStep, onChange],
  );

  const clearSelection = useCallback(() => {
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const processNewAnnotation = useCallback(
    (selection: PendingSelection, label: string) => {
      const exactText = selection.text;
      const regex = new RegExp(`\\b${escapeRegExp(exactText)}\\b`, "gi");
      const matches: { start: number; end: number }[] = [];

      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + exactText.length,
        });
      }

      updateAnnotations((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          article_id: articleId,
          start: selection.start,
          end: selection.end,
          label,
        },
      ]);

      const otherMatches = matches.filter((m) => m.start !== selection.start);
      if (otherMatches.length > 0) {
        setBulkSuggestion({ label, text: exactText, matches: otherMatches });
      }
    },
    [text, updateAnnotations, articleId],
  );

  useEffect(() => {
    if (!isEditable) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (bulkSuggestion) {
        if (e.key === "Enter") {
          e.preventDefault();
          const bulkAnnotations: Annotation[] = bulkSuggestion.matches.map(
            (m) => ({
              id: crypto.randomUUID(),
              article_id: articleId,
              start: m.start,
              end: m.end,
              label: bulkSuggestion.label,
            }),
          );
          updateAnnotations((prev) => [...prev, ...bulkAnnotations]);
          setBulkSuggestion(null);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setBulkSuggestion(null);
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey && historyStep < history.length - 1) {
          const nextStep = historyStep + 1;
          setHistoryStep(nextStep);
          setAnnotations(history[nextStep]);
          onChange?.(history[nextStep]);
        } else if (!e.shiftKey && historyStep > 0) {
          const nextStep = historyStep - 1;
          setHistoryStep(nextStep);
          setAnnotations(history[nextStep]);
          onChange?.(history[nextStep]);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        if (historyStep < history.length - 1) {
          const nextStep = historyStep + 1;
          setHistoryStep(nextStep);
          setAnnotations(history[nextStep]);
          onChange?.(history[nextStep]);
        }
        return;
      }

      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        hoveredAnnotationId
      ) {
        e.preventDefault();
        updateAnnotations((prev) =>
          prev.filter((ann) => ann.id !== hoveredAnnotationId),
        );
        setHoveredAnnotationId(null);
        return;
      }

      const keyNumber = parseInt(e.key, 10);
      if (
        !isNaN(keyNumber) &&
        keyNumber > 0 &&
        keyNumber <= availableLabels.length
      ) {
        e.preventDefault();
        const selectedLabel = availableLabels[keyNumber - 1];

        if (pendingSelection) {
          processNewAnnotation(pendingSelection, selectedLabel);
          clearSelection();
        } else {
          setActiveModeLabel((prev) =>
            prev === selectedLabel ? null : selectedLabel,
          );
        }
        return;
      }

      if (e.key === "Escape") {
        clearSelection();
        setActiveModeLabel(null);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    pendingSelection,
    availableLabels,
    hoveredAnnotationId,
    history,
    historyStep,
    isEditable,
    bulkSuggestion,
    text,
    onChange,
    processNewAnnotation,
    updateAnnotations,
    clearSelection,
    articleId,
  ]);

  const handleMouseUp = useCallback(() => {
    if (!isEditable || !containerRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      clearSelection();
      return;
    }

    const rawOffsets = getSelectionOffsets();
    if (!rawOffsets) return;

    const snapped = snapToWordBoundary(text, rawOffsets.start, rawOffsets.end);

    if (snapped.start === snapped.end) {
      clearSelection();
      return;
    }

    if (activeModeLabel) {
      processNewAnnotation(snapped, activeModeLabel);
      window.getSelection()?.removeAllRanges();
      return;
    }

    setPendingSelection(snapped);
  }, [isEditable, clearSelection, text, activeModeLabel, processNewAnnotation]);

  const renderAnnotatedText = () => {
    if (!text) return null;

    const boundarySet = new Set([0, text.length]);
    annotations.forEach((a) => {
      boundarySet.add(a.start);
      boundarySet.add(a.end);
    });
    const boundaries = Array.from(boundarySet).sort((a, b) => a - b);

    const parts = [];

    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1];
      if (start === end) continue;

      const segmentText = text.slice(start, end);
      const activeAnns = annotations.filter(
        (a) => a.start <= start && a.end >= end,
      );

      if (activeAnns.length === 0) {
        parts.push(
          <span
            key={`${start}-${end}`}
            data-start={start}
            className="leading-7"
          >
            {segmentText}
          </span>,
        );
        continue;
      }

      activeAnns.sort((a, b) => a.end - a.start - (b.end - b.start));

      const isHovered = activeAnns.some((a) => a.id === hoveredAnnotationId);
      const activeBgAnnotation = isHovered
        ? activeAnns.find((a) => a.id === hoveredAnnotationId)!
        : activeAnns[0];

      const bgColors = getProceduralColor(
        activeBgAnnotation.label,
        availableLabels,
      );

      const endingAnns = activeAnns.filter((a) => a.end === end);

      parts.push(
        <span
          key={`seg-${start}-${end}`}
          className="inline-flex items-center overflow-hidden rounded-sm align-baseline mx-0.5 transition-colors duration-150 ease-in-out bg-white dark:bg-bp-dark-surface"
          style={{
            color: bgColors.solid,
            boxShadow: `inset 0 0 0 1px ${bgColors.solid}`,
          }}
        >
          <span data-start={start} className="pl-2 pr-1.5">
            {segmentText}
          </span>

          {endingAnns.map((ann) => {
            const colors = getProceduralColor(ann.label, availableLabels);

            const tagElement = (
              <span
                key={`tag-${ann.id}`}
                onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                onMouseLeave={() => setHoveredAnnotationId(null)}
                className={`py-1 px-2 text-xs font-medium ${isEditable ? "cursor-pointer hover:brightness-95" : "cursor-default"} select-none`}
                style={{
                  background: colors.light,
                  color: colors.solid,
                }}
              >
                {ann.label}
              </span>
            );

            const wrappedTag =
              ann.confidence !== undefined ? (
                <Tooltip
                  content={`${Math.round(ann.confidence * 100)}% confidence`}
                  placement="top"
                >
                  {tagElement}
                </Tooltip>
              ) : (
                tagElement
              );

            return isEditable ? (
              <Popover
                key={`tag-pop-${ann.id}`}
                interactionKind="hover"
                minimal={true}
                content={
                  <Menu>
                    <li className={Classes.MENU_HEADER}>
                      <div className="flex items-center justify-between gap-4">
                        <h6 className={Classes.HEADING}>{ann.label}</h6>
                        {ann.confidence !== undefined && (
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-bp-dark-header px-1 rounded">
                            {Math.round(ann.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </li>
                    <MenuItem
                      text="Remove"
                      icon="trash"
                      intent={Intent.DANGER}
                      label="Backspace"
                      onClick={() => {
                        updateAnnotations((prev) =>
                          prev.filter((a) => a.id !== ann.id),
                        );
                        setHoveredAnnotationId(null);
                      }}
                    />
                  </Menu>
                }
              >
                {wrappedTag}
              </Popover>
            ) : (
              <span key={`tag-wrap-${ann.id}`}>{wrappedTag}</span>
            );
          })}
        </span>,
      );
    }

    return parts;
  };

  return (
    <div className="relative">
      {bulkSuggestion && (
        <div
          className={`absolute top-4 right-4 bg-white dark:bg-bp-dark-bg border border-gray-200 dark:border-bp-dark-border py-2 px-3 rounded z-20 flex items-center gap-3 text-[13px] animate-[fade-in_0.2s_ease] ${Classes.ELEVATION_3}`}
        >
          <Icon icon="lightbulb" intent={Intent.WARNING} />
          <span>
            Press <strong>Enter</strong> to label{" "}
            {bulkSuggestion.matches.length} more occurrences of "
            <em>{bulkSuggestion.text}</em>"
          </span>
          <span className="text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-bp-dark-border pl-3">
            Esc to dismiss
          </span>
        </div>
      )}

      <div className="mb-4 flex items-center gap-1.5 flex-wrap border-b pb-2 border-gray-300 dark:border-[#5e6064]">
        {availableLabels.map((label, idx) => {
          const isActive = activeModeLabel === label;
          const colors = getProceduralColor(label, availableLabels);

          return (
            <Button
              key={label}
              small
              minimal
              disabled={!isEditable}
              onClick={() =>
                isEditable &&
                setActiveModeLabel((prev) => (prev === label ? null : label))
              }
              className="overflow-hidden! rounded-2xl transition-all duration-150 ease-in-out pr-0! bg-white dark:bg-bp-dark-bg"
              style={{
                background: isActive ? colors.solid : undefined,
                color: colors.solid,
                boxShadow: `inset 0 0 0 1px ${colors.solid}`,
                opacity: isEditable ? 1 : 0.8,
              }}
            >
              <span style={{ color: isActive ? "#ffffff" : colors.solid }}>
                {label}
              </span>
              <span
                className="ml-2 py-1 px-1.5"
                style={{
                  background: isActive
                    ? "rgba(255,255,255,0.25)"
                    : colors.light,
                  color: isActive ? "#ffffff" : colors.solid,
                }}
              >
                {idx + 1}
              </span>
            </Button>
          );
        })}
        {isEditable && activeModeLabel && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
            Highlight text to apply <strong>{activeModeLabel}</strong>.{" "}
            <Tag minimal>Esc</Tag> to exit.
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className={`leading-relaxed whitespace-pre-line ${activeModeLabel ? "cursor-crosshair" : "cursor-text"} text-gray-800 dark:text-gray-100`}
      >
        {renderAnnotatedText()}
      </div>
    </div>
  );
}
