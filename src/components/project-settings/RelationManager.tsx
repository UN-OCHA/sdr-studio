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
} from "@blueprintjs/core";
import { useState, useImperativeHandle, forwardRef } from "react";

type RelationManagerProps = {
  relations: Record<string, string>;
  onChange: (relations: Record<string, string>) => void;
};

export const RelationManager = forwardRef(({ relations, onChange }: RelationManagerProps, ref) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useImperativeHandle(ref, () => ({
    openAdd: () => {
      setEditingKey(null);
      setName("");
      setDescription("");
      setIsDialogOpen(true);
    },
  }));

  const handleOpenEdit = (key: string) => {
    setEditingKey(key);
    setName(key);
    setDescription(relations[key]);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const next = { ...relations };
    if (editingKey && editingKey !== name.trim()) {
      delete next[editingKey];
    }

    next[name.trim()] = description.trim() || `Description for ${name}`;
    onChange(next);
    setIsDialogOpen(false);
  };

  const handleRemove = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    const next = { ...relations };
    delete next[key];
    onChange(next);
  };

  const entries = Object.entries(relations);

  return (
    <>
      {entries.map(([rel, desc]) => (
        <Card
          key={rel}
          className="p-3 border-none shadow-none flex items-center justify-between"
        >
          <EntityTitle
            title={rel}
            icon="exchange"
            subtitle={
              <div className="flex flex-col">
                 <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter text-[9px] mb-0.5">
                    Binary Relation
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
              onClick={() => handleOpenEdit(rel)}
              title="Edit Relation"
            />
            <Button
              icon="trash"
              minimal
              small
              intent={Intent.DANGER}
              onClick={(e) => handleRemove(e, rel)}
              title="Remove Relation"
            />
          </div>
        </Card>
      ))}
      {entries.length === 0 && (
        <div className="text-center py-10 bg-gray-50 dark:bg-bp-dark-surface border border-dashed border-gray-200 dark:border-bp-dark-border rounded text-gray-400 text-xs italic">
          No relations defined yet.
        </div>
      )}

      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingKey ? `Edit Relation Label: ${editingKey}` : "Add New Relation Label"}
        icon="exchange"
        className="pb-0"
      >
        <div className="p-4 space-y-4">
          <FormGroup label="Relation Name" labelInfo="(Required)">
            <InputGroup
              placeholder="e.g. occurred_in or victim_of"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormGroup>

          <FormGroup label="Description / Model Hints">
            <TextArea
              fill
              autoResize
              placeholder="Provide context to help the model identify this relationship..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </FormGroup>
        </div>

        <Divider className="m-0" />
        <div className="p-3 bg-gray-50 dark:bg-bp-dark-surface flex justify-end gap-2 rounded-b">
          <Button text="Cancel" onClick={() => setIsDialogOpen(false)} minimal />
          <Button
            intent={Intent.PRIMARY}
            icon={editingKey ? "tick" : "plus"}
            text={editingKey ? "Save Changes" : "Add Relation"}
            disabled={!name.trim()}
            onClick={handleSave}
          />
        </div>
      </Dialog>
    </>
  );
});
