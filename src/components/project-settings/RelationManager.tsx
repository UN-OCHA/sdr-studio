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

type RelationManagerProps = {
  relations: Record<string, string>;
  onChange: (relations: Record<string, string>) => void;
};

export function RelationManager({ relations, onChange }: RelationManagerProps) {
  const [newRel, setNewRel] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleAdd = () => {
    if (newRel.trim()) {
      onChange({
        ...relations,
        [newRel.trim()]: newDesc.trim() || `Description for ${newRel}`,
      });
      setNewRel("");
      setNewDesc("");
    }
  };

  const handleRemove = (key: string) => {
    const next = { ...relations };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <H5>Relation Extraction Labels</H5>
      <p className="text-xs text-gray-500">
        Define relationships to extract between entities.
      </p>

      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md min-h-[60px]">
        {Object.entries(relations).map(([rel, desc]) => (
          <Tag
            key={rel}
            large
            minimal
            intent={Intent.WARNING}
            onRemove={() => handleRemove(rel)}
            title={desc}
          >
            {rel}
          </Tag>
        ))}
        {Object.keys(relations).length === 0 && (
          <span className="text-gray-400 italic text-sm">
            No relations added yet.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <ControlGroup>
          <InputGroup
            placeholder="Relation Name (e.g. occurred_in)"
            value={newRel}
            onChange={(e) => setNewRel(e.target.value)}
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
