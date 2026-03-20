import {
  Button,
  Card,
  ControlGroup,
  Dialog,
  Divider,
  EntityTitle,
  FormGroup,
  InputGroup,
  Intent,
  Tag,
  Switch,
  NumericInput,
  Tooltip,
} from "@blueprintjs/core";
import { useState, useImperativeHandle, forwardRef } from "react";
import type { Project } from "../../types";

type ClassificationConfig = NonNullable<Project["extraction_config"]["classifications"]>;

type ClassificationManagerProps = {
  classifications: ClassificationConfig;
  onChange: (classifications: ClassificationConfig) => void;
};

export const ClassificationManager = forwardRef(({
  classifications,
  onChange,
}: ClassificationManagerProps, ref) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [currentOptions, setCurrentOptions] = useState<
    Array<{ label: string; description: string }>
  >([]);
  const [optionInput, setOptionInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [multiLabel, setMultiLabel] = useState(false);
  const [threshold, setThreshold] = useState(0.5);

  useImperativeHandle(ref, () => ({
    openAdd: () => {
      setEditingKey(null);
      setName("");
      setCurrentOptions([]);
      setOptionInput("");
      setDescInput("");
      setMultiLabel(false);
      setThreshold(0.5);
      setIsDialogOpen(true);
    },
  }));

  const handleOpenEdit = (key: string) => {
    const config = classifications[key];
    setEditingKey(key);
    setName(key);
    
    if (Array.isArray(config)) {
      setCurrentOptions(config.map(opt => ({ label: opt, description: "" })));
      setMultiLabel(false);
      setThreshold(0.5);
    } else {
      const opts = config.labels || [];
      if (Array.isArray(opts)) {
        setCurrentOptions(opts.map(opt => ({ label: opt, description: "" })));
      } else {
        setCurrentOptions(Object.entries(opts).map(([l, d]) => ({ label: l, description: d })));
      }
      setMultiLabel(config.multi_label || false);
      setThreshold(config.threshold ?? 0.5);
    }
    setIsDialogOpen(true);
  };

  const handleAddOption = () => {
    if (
      optionInput.trim() &&
      !currentOptions.find((o) => o.label === optionInput.trim())
    ) {
      setCurrentOptions([
        ...currentOptions,
        { label: optionInput.trim(), description: descInput.trim() },
      ]);
      setOptionInput("");
      setDescInput("");
    }
  };

  const handleRemoveOption = (label: string) => {
    setCurrentOptions(currentOptions.filter((o) => o.label !== label));
  };

  const handleSave = () => {
    if (!name.trim() || currentOptions.length === 0) return;

    const next = { ...classifications };
    if (editingKey && editingKey !== name.trim()) {
      delete next[editingKey];
    }

    const labels: Record<string, string> = {};
    currentOptions.forEach((o) => {
      labels[o.label] = o.description;
    });

    next[name.trim()] = {
      labels: labels,
      multi_label: multiLabel,
      threshold: threshold,
    };

    onChange(next);
    setIsDialogOpen(false);
  };

  const handleRemoveClassification = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    const next = { ...classifications };
    delete next[key];
    onChange(next);
  };

  const entries = Object.entries(classifications);

  return (
    <>
      {entries.map(([name, config]) => {
        const isMulti = !Array.isArray(config) && config.multi_label;
        const t = !Array.isArray(config) ? config.threshold : 0.5;
        const options = Array.isArray(config)
          ? config
          : config.labels
          ? Array.isArray(config.labels)
            ? config.labels
            : Object.keys(config.labels)
          : [];

        return (
          <Card
            key={name}
            className="p-3 border-none shadow-none flex items-center justify-between"
          >
            <EntityTitle
              title={name}
              icon={isMulti ? "property" : "list"}
              subtitle={
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter text-[9px] mb-0.5">
                    {isMulti ? "Multi-label Classification" : "Single Choice Classification"} • Confidence ≥ {t}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {options.slice(0, 8).map(opt => (
                      <span key={opt} className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-bp-dark-header px-1 rounded">{opt}</span>
                    ))}
                    {options.length > 8 && <span className="text-[10px] text-gray-400">+{options.length - 8} more</span>}
                  </div>
                </div>
              }
            />
            <div className="flex items-center gap-2">
              <Button
                icon="edit"
                minimal
                small
                onClick={() => handleOpenEdit(name)}
                title="Edit Classification"
              />
              <Button
                icon="trash"
                minimal
                small
                intent={Intent.DANGER}
                onClick={(e) => handleRemoveClassification(e, name)}
                title="Remove Classification"
              />
            </div>
          </Card>
        );
      })}
      {entries.length === 0 && (
        <div className="text-center py-10 bg-gray-50 dark:bg-bp-dark-surface border border-dashed border-gray-200 dark:border-bp-dark-border rounded text-gray-400 text-xs italic">
          No classifications defined yet.
        </div>
      )}

      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingKey ? `Edit Classification: ${editingKey}` : "Add New Classification"}
        icon="layers"
        className="pb-0"
        style={{ width: "500px" }}
      >
        <div className="p-4 space-y-4">
          <FormGroup label="Category Name" labelInfo="(Required)">
            <InputGroup
              placeholder="e.g. Sentiment or Severity"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormGroup>

          <FormGroup label="Options" labelInfo="(At least one)">
            <div className="flex flex-wrap gap-2 mb-3 min-h-[40px] p-2 bg-white dark:bg-bp-dark-bg border border-gray-200 dark:border-bp-dark-border rounded max-h-32 overflow-y-auto">
              {currentOptions.map((opt) => (
                <Tooltip key={opt.label} content={opt.description || "No description"}>
                  <Tag
                    onRemove={() => handleRemoveOption(opt.label)}
                    intent={Intent.PRIMARY}
                    minimal
                    round
                  >
                    {opt.label}
                  </Tag>
                </Tooltip>
              ))}
              {currentOptions.length === 0 && (
                <span className="text-gray-400 text-xs self-center">No options added yet.</span>
              )}
            </div>
            <ControlGroup fill>
              <InputGroup
                placeholder="Option label..."
                value={optionInput}
                onChange={(e) => setOptionInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddOption()}
              />
              <InputGroup
                placeholder="Description (hints)..."
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddOption()}
              />
              <Button icon="plus" onClick={handleAddOption} />
            </ControlGroup>
          </FormGroup>

          <div className="grid grid-cols-2 gap-4">
            <FormGroup label="Multi-label">
              <Switch
                checked={multiLabel}
                onChange={(e) => setMultiLabel(e.currentTarget.checked)}
                label="Allow multiple choices"
              />
            </FormGroup>

            <FormGroup label="Threshold" helperText="Min confidence (0-1)">
              <NumericInput
                fill
                min={0}
                max={1}
                stepSize={0.05}
                minorStepSize={0.01}
                value={threshold}
                onValueChange={(v) => setThreshold(v)}
              />
            </FormGroup>
          </div>
        </div>

        <Divider className="m-0" />
        <div className="p-3 bg-gray-50 dark:bg-bp-dark-surface flex justify-end gap-2 rounded-b">
          <Button text="Cancel" onClick={() => setIsDialogOpen(false)} minimal />
          <Button
            intent={Intent.PRIMARY}
            icon={editingKey ? "tick" : "plus"}
            text={editingKey ? "Save Changes" : "Add Classification"}
            disabled={!name.trim() || currentOptions.length === 0}
            onClick={handleSave}
          />
        </div>
      </Dialog>
    </>
  );
});
