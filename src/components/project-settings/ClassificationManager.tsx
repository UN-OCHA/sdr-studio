import {
  Button,
  ControlGroup,
  FormGroup,
  H5,
  InputGroup,
  Intent,
  Tag,
} from "@blueprintjs/core";
import { useState } from "react";

type ClassificationManagerProps = {
  classifications: Record<string, string[]>;
  onChange: (classifications: Record<string, string[]>) => void;
};

export function ClassificationManager({
  classifications,
  onChange,
}: ClassificationManagerProps) {
  const [newName, setNewName] = useState("");
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState("");

  const handleAddOption = () => {
    if (optionInput.trim() && !currentOptions.includes(optionInput.trim())) {
      setCurrentOptions([...currentOptions, optionInput.trim()]);
      setOptionInput("");
    }
  };

  const handleRemoveOption = (opt: string) => {
    setCurrentOptions(currentOptions.filter((o) => o !== opt));
  };

  const handleAddClassification = () => {
    if (newName.trim() && currentOptions.length > 0) {
      onChange({ ...classifications, [newName.trim()]: currentOptions });
      setNewName("");
      setCurrentOptions([]);
    }
  };

  const handleRemoveClassification = (key: string) => {
    const next = { ...classifications };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <H5>Classifications</H5>
      <p className="text-xs text-gray-500">
        Categorize the overall text (e.g. Sentiment, Severity).
      </p>

      <div className="space-y-3">
        {Object.entries(classifications).map(([name, options]) => (
          <div
            key={name}
            className="p-4 bg-white border border-gray-200 shadow-sm rounded-lg flex justify-between items-start"
          >
            <div className="grow">
              <span className="font-bold text-sm text-gray-800 block mb-2">
                {name}
              </span>
              <div className="flex flex-wrap gap-1">
                {options.map((opt) => (
                  <Tag key={opt} minimal round intent={Intent.NONE}>
                    {opt}
                  </Tag>
                ))}
              </div>
            </div>
            <Button
              icon="trash"
              minimal
              intent={Intent.DANGER}
              onClick={() => handleRemoveClassification(name)}
            />
          </div>
        ))}
        {Object.keys(classifications).length === 0 && (
          <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-gray-400 text-xs italic">
            No classifications defined.
          </div>
        )}
      </div>

      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-inner">
        <H5 className="text-sm mb-3">Add New Classification</H5>
        <div className="space-y-4">
          <FormGroup
            label="Category Name"
            labelInfo="(e.g. Severity)"
            className="mb-0"
          >
            <InputGroup
              placeholder="Enter category name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </FormGroup>

          <FormGroup
            label="Options"
            helperText="Add possible choices for this classification."
            className="mb-0"
          >
            <div className="flex flex-wrap gap-2 mb-3 min-h-[40px] p-2 bg-white border border-gray-200 rounded">
              {currentOptions.map((opt) => (
                <Tag
                  key={opt}
                  onRemove={() => handleRemoveOption(opt)}
                  intent={Intent.PRIMARY}
                  minimal
                >
                  {opt}
                </Tag>
              ))}
              {currentOptions.length === 0 && (
                <span className="text-gray-400 text-xs self-center">
                  No options added.
                </span>
              )}
            </div>
            <ControlGroup>
              <InputGroup
                placeholder="Option name..."
                value={optionInput}
                onChange={(e) => setOptionInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddOption()}
                fill
              />
              <Button icon="plus" onClick={handleAddOption} text="Add" />
            </ControlGroup>
          </FormGroup>

          <Button
            fill
            intent={Intent.PRIMARY}
            icon="add"
            text="Add Classification to Project"
            disabled={!newName.trim() || currentOptions.length === 0}
            onClick={handleAddClassification}
          />
        </div>
      </div>
    </div>
  );
}
