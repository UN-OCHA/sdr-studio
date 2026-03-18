import {
  Button,
  ControlGroup,
  H5,
  InputGroup,
  Intent,
  Tag,
  TextArea,
} from "@blueprintjs/core";
import { useState } from "react";

type LabelManagerProps = {
  labels: Record<string, string>;
  onChange: (labels: Record<string, string>) => void;
};

export function LabelManager({ labels, onChange }: LabelManagerProps) {
  const [newLabel, setNewLabel] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleAdd = () => {
    if (newLabel.trim()) {
      onChange({
        ...labels,
        [newLabel.trim()]: newDesc.trim() || `Description for ${newLabel}`,
      });
      setNewLabel("");
      setNewDesc("");
    }
  };

  const handleRemove = (key: string) => {
    const next = { ...labels };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <H5>Entity Extraction Labels</H5>
      <p className="text-xs text-gray-500">
        Define span-based entities like "Location" or "Casualties".
      </p>

      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md min-h-[60px]">
        {Object.entries(labels).map(([label, desc]) => (
          <Tag
            key={label}
            large
            minimal
            intent={Intent.PRIMARY}
            onRemove={() => handleRemove(label)}
            title={desc}
          >
            {label}
          </Tag>
        ))}
        {Object.keys(labels).length === 0 && (
          <span className="text-gray-400 italic text-sm">
            No labels added yet.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <ControlGroup>
          <InputGroup
            placeholder="Label Name (e.g. Location)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            fill
          />
          <Button
            icon="plus"
            intent={Intent.PRIMARY}
            onClick={handleAdd}
            text="Add"
          />
        </ControlGroup>
        <TextArea
          placeholder="Description (Optional) - provide hints for the extraction model..."
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          fill
          rows={2}
          className="text-xs"
        />
      </div>
    </div>
  );
}
