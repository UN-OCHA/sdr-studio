import {
  Button,
  Card,
  Dialog,
  Divider,
  EntityTitle,
  FormGroup,
  InputGroup,
  Intent,
  TextArea,
  HTMLSelect,
  NumericInput,
  Checkbox,
  Tag,
} from "@blueprintjs/core";
import { useState, useImperativeHandle, forwardRef } from "react";
import type { Project } from "../../types";

type EntityConfig = NonNullable<Project["extraction_config"]["entities"]>;

type LabelManagerProps = {
  labels: EntityConfig;
  onChange: (labels: EntityConfig) => void;
};

export const LabelManager = forwardRef(({ labels, onChange }: LabelManagerProps, ref) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [threshold, setThreshold] = useState<number>(0.3);
  const [dtype, setDtype] = useState<"str" | "list">("list");
  const [isLocation, setIsLocation] = useState(false);
  const [isDate, setIsDate] = useState(false);

  useImperativeHandle(ref, () => ({
    openAdd: () => {
      setEditingKey(null);
      setName("");
      setDescription("");
      setThreshold(0.3);
      setDtype("list");
      setIsLocation(false);
      setIsDate(false);
      setIsDialogOpen(true);
    },
  }));

  const handleOpenEdit = (key: string) => {
    const config = labels[key];
    setEditingKey(key);
    setName(key);
    if (typeof config === "string") {
      setDescription(config);
      setThreshold(0.3);
      setDtype("list");
      setIsLocation(false);
      setIsDate(false);
    } else {
      setDescription(config.description);
      setThreshold(config.threshold || 0.3);
      setDtype(config.dtype || "list");
      setIsLocation(!!config.is_location);
      setIsDate(!!config.is_date);
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const next = { ...labels };
    if (editingKey && editingKey !== name.trim()) {
      delete next[editingKey];
    }

    next[name.trim()] = {
      description: description.trim() || `Description for ${name}`,
      threshold,
      dtype,
      is_location: isLocation,
      is_date: isDate,
    };

    onChange(next);
    setIsDialogOpen(false);
  };

  const handleRemove = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    const next = { ...labels };
    delete next[key];
    onChange(next);
  };

  const entries = Object.entries(labels);

  return (
    <>
      {entries.map(([label, config]) => {
        const desc = typeof config === "string" ? config : config.description;
        const t = typeof config === "string" ? 0.3 : config.threshold || 0.3;
        const d = typeof config === "string" ? "list" : config.dtype || "list";
        const isLoc = typeof config === "string" ? false : !!config.is_location;
        const isD = typeof config === "string" ? false : !!config.is_date;

        return (
          <Card
            key={label}
            className="p-3 border-none shadow-none flex items-center justify-between"
          >
            <EntityTitle
              title={
                <div className="flex items-center gap-2">
                  <span>{label}</span>
                  {isLoc && (
                    <Tag minimal intent={Intent.PRIMARY} round icon="map-marker">
                      Location
                    </Tag>
                  )}
                  {isD && (
                    <Tag minimal intent={Intent.WARNING} round icon="calendar">
                      Date
                    </Tag>
                  )}
                </div>
              }
              icon={d === "str" ? "selection" : "layers"}
              subtitle={
                <div className="flex flex-col">
                  <span className="text-gray-500 font-bold uppercase tracking-tighter text-[9px] mb-0.5">
                    {d === "str" ? "Single Best Span" : "Multiple Spans"} • Confidence ≥ {t}
                  </span>
                  <span className="line-clamp-1 text-[11px] text-gray-600">{desc}</span>
                </div>
              }
            />
            <div className="flex items-center gap-2">
              <Button
                icon="edit"
                minimal
                small
                onClick={() => handleOpenEdit(label)}
                title="Edit Label"
              />
              <Button
                icon="trash"
                minimal
                small
                intent={Intent.DANGER}
                onClick={(e) => handleRemove(e, label)}
                title="Remove Label"
              />
            </div>
          </Card>
        );
      })}
      {entries.length === 0 && (
        <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded text-gray-400 text-xs italic">
          No entity labels defined yet.
        </div>
      )}

      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingKey ? `Edit Entity Label: ${editingKey}` : "Add New Entity Label"}
        icon="tag"
        className="pb-0"
      >
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormGroup label="Label Name" labelInfo="(Required)">
              <InputGroup
                placeholder="e.g. Location"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="Extraction Mode">
              <HTMLSelect
                fill
                value={dtype}
                onChange={(e) => setDtype(e.target.value as "str" | "list")}
              >
                <option value="list">Multiple Spans (List)</option>
                <option value="str">Single Best Span (String)</option>
              </HTMLSelect>
            </FormGroup>
          </div>

          <FormGroup label="Threshold" helperText="Minimum confidence score (0-1)">
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

          <div className="flex gap-6 pt-2">
            <Checkbox
              label="Is Location"
              checked={isLocation}
              onChange={(e) => setIsLocation(e.currentTarget.checked)}
            />
            <Checkbox
              label="Is Date/Time"
              checked={isDate}
              onChange={(e) => setIsDate(e.currentTarget.checked)}
            />
          </div>

          <FormGroup label="Description / Model Hints">
            <TextArea
              fill
              autoResize
              placeholder="Provide context to help the model identify this entity..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </FormGroup>
        </div>

        <Divider className="m-0" />
        <div className="p-3 bg-gray-50 flex justify-end gap-2 rounded-b">
          <Button text="Cancel" onClick={() => setIsDialogOpen(false)} minimal />
          <Button
            intent={Intent.PRIMARY}
            icon={editingKey ? "tick" : "plus"}
            text={editingKey ? "Save Changes" : "Add Label"}
            disabled={!name.trim()}
            onClick={handleSave}
          />
        </div>
      </Dialog>
    </>
  );
});
