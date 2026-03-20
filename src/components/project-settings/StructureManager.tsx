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
  NumericInput,
  HTMLSelect,
  HTMLTable,
} from "@blueprintjs/core";
import { useState, useImperativeHandle, forwardRef } from "react";

type Field = {
  name: string;
  dtype: "str" | "int" | "float" | "bool" | "list";
  choices?: string[];
  description?: string;
  threshold?: number;
  validator_pattern?: string;
};

type Structure = {
  name: string;
  fields: Field[];
};

type StructureManagerProps = {
  structures: Structure[];
  onChange: (structures: Structure[]) => void;
};

export const StructureManager = forwardRef(({
  structures,
  onChange,
}: StructureManagerProps, ref) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  
  const [structName, setStructName] = useState("");
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);

  useImperativeHandle(ref, () => ({
    openAdd: () => {
      setRenamingIdx(null);
      setStructName("");
      setIsAddDialogOpen(true);
    },
  }));

  const handleSaveStructure = () => {
    if (!structName.trim()) return;

    const next = [...structures];
    if (renamingIdx !== null) {
      next[renamingIdx].name = structName.trim();
    } else {
      if (structures.find(s => s.name === structName.trim())) return;
      next.push({ name: structName.trim(), fields: [] });
    }
    
    onChange(next);
    setIsAddDialogOpen(false);
    if (renamingIdx === null) {
        setEditingIdx(next.length - 1); 
    }
  };

  const handleOpenRename = (idx: number) => {
    setRenamingIdx(idx);
    setStructName(structures[idx].name);
    setIsAddDialogOpen(true);
  };

  const handleRemoveStructure = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const next = [...structures];
    next.splice(index, 1);
    onChange(next);
  };

  const handleAddField = (structIdx: number) => {
    const next = [...structures];
    next[structIdx].fields.push({
      name: `field_${next[structIdx].fields.length + 1}`,
      dtype: "str",
      description: "",
      threshold: 0.3,
    });
    onChange(next);
  };

  const handleUpdateField = (
    structIdx: number,
    fieldIdx: number,
    updates: Partial<Field>,
  ) => {
    const next = [...structures];
    next[structIdx].fields[fieldIdx] = {
      ...next[structIdx].fields[fieldIdx],
      ...updates,
    };
    onChange(next);
  };

  const handleRemoveField = (structIdx: number, fieldIdx: number) => {
    const next = [...structures];
    next[structIdx].fields.splice(fieldIdx, 1);
    onChange(next);
  };

  return (
    <>
      {structures.map((s, idx) => (
        <Card
          key={s.name}
          className="p-3 border-none shadow-none flex items-center justify-between"
        >
          <EntityTitle
            title={s.name}
            icon="code"
            subtitle={
              <div className="flex flex-col">
                <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter text-[9px] mb-0.5">
                  JSON Object • {s.fields.length} fields
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.fields.slice(0, 6).map(f => (
                    <span key={f.name} className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-bp-dark-header px-1 rounded">{f.name}</span>
                  ))}
                  {s.fields.length > 6 && <span className="text-[10px] text-gray-400">+{s.fields.length - 6} more</span>}
                </div>
              </div>
            }
          />
          <div className="flex items-center gap-2">
            <Button
              icon="properties"
              minimal
              small
              onClick={() => setEditingIdx(idx)}
              title="Edit Schema Fields"
              text="Fields"
            />
            <Button
              icon="edit"
              minimal
              small
              onClick={() => handleOpenRename(idx)}
              title="Rename Object"
            />
            <Button
              icon="trash"
              minimal
              small
              intent={Intent.DANGER}
              onClick={(e) => handleRemoveStructure(e, idx)}
              title="Remove Object"
            />
          </div>
        </Card>
      ))}
      {structures.length === 0 && (
        <div className="text-center py-10 bg-gray-50 dark:bg-bp-dark-surface border border-dashed border-gray-200 dark:border-bp-dark-border rounded text-gray-400 text-xs italic">
          No structured objects defined yet.
        </div>
      )}

      <Dialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        title={renamingIdx !== null ? `Rename Object: ${structures[renamingIdx].name}` : "Create New Structured Object"}
        icon="code-block"
      >
        <div className="p-4">
          <FormGroup label="Object Name" labelInfo="(Required)">
            <InputGroup
              placeholder="e.g. CasualtyReport or WeatherDetails"
              value={structName}
              onChange={(e) => setStructName(e.target.value)}
            />
          </FormGroup>
        </div>
        <Divider className="m-0" />
        <div className="p-3 bg-gray-50 dark:bg-bp-dark-surface flex justify-end gap-2 rounded-b">
          <Button text="Cancel" onClick={() => setIsAddDialogOpen(false)} minimal />
          <Button
            intent={Intent.PRIMARY}
            icon={renamingIdx !== null ? "tick" : "plus"}
            text={renamingIdx !== null ? "Save Name" : "Create Object"}
            disabled={!structName.trim()}
            onClick={handleSaveStructure}
          />
        </div>
      </Dialog>

      <Dialog
        isOpen={editingIdx !== null}
        onClose={() => setEditingIdx(null)}
        title={editingIdx !== null ? `Edit Fields: ${structures[editingIdx].name}` : "Edit Schema"}
        icon="properties"
        style={{ width: "900px" }}
        className="pb-0"
      >
        <div className="p-0 max-h-[70vh] overflow-y-auto">
          {editingIdx !== null && (
            <HTMLTable className="w-full" striped bordered={false}>
              <thead className="sticky top-0 bg-white dark:bg-bp-dark-bg z-10 shadow-sm">
                <tr>
                  <th className="p-3 text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-bp-dark-border">
                    Field Name
                  </th>
                  <th className="w-24 p-3 text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-bp-dark-border">
                    Type
                  </th>
                  <th className="w-24 p-3 text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-bp-dark-border">
                    Threshold
                  </th>
                  <th className="w-40 p-3 text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-bp-dark-border">
                    Regex Validator
                  </th>
                  <th className="p-3 text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-bp-dark-border">
                    Extraction Hints
                  </th>
                  <th className="w-12 p-3 border-b border-gray-200 dark:border-bp-dark-border"></th>
                </tr>
              </thead>
              <tbody>
                {structures[editingIdx].fields.map((f, fIdx) => (
                  <tr key={fIdx} className="align-top">
                    <td className="p-2">
                      <InputGroup
                        asyncControl
                        className="font-bold text-blue-800"
                        value={f.name}
                        onChange={(e) =>
                          handleUpdateField(editingIdx, fIdx, {
                            name: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <HTMLSelect
                        fill
                        value={f.dtype}
                        onChange={(e) =>
                          handleUpdateField(editingIdx, fIdx, {
                            dtype: e.target.value as Field["dtype"],
                          })
                        }
                      >
                        <option value="str">str</option>
                        <option value="int">int</option>
                        <option value="float">float</option>
                        <option value="bool">bool</option>
                        <option value="list">list</option>
                      </HTMLSelect>
                    </td>
                    <td className="p-2">
                      <NumericInput
                        min={0}
                        max={1}
                        stepSize={0.05}
                        minorStepSize={0.01}
                        value={f.threshold ?? 0.3}
                        onValueChange={(v) =>
                          handleUpdateField(editingIdx, fIdx, {
                            threshold: v,
                          })
                        }
                        fill
                      />
                    </td>
                    <td className="p-2">
                      <InputGroup
                        asyncControl
                        placeholder="e.g. ^\d+$"
                        className="font-mono text-[11px]"
                        value={f.validator_pattern || ""}
                        onChange={(e) =>
                          handleUpdateField(editingIdx, fIdx, {
                            validator_pattern: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <TextArea
                        fill
                        autoResize
                        placeholder="Hints for the extractor..."
                        value={f.description || ""}
                        onChange={(e) =>
                          handleUpdateField(editingIdx, fIdx, {
                            description: e.target.value,
                          })
                        }
                        rows={2}
                        className="text-[11px]"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        icon="cross"
                        minimal
                        small
                        onClick={() => handleRemoveField(editingIdx, fIdx)}
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={6} className="p-3 bg-gray-50 dark:bg-bp-dark-surface">
                    <Button
                      icon="plus"
                      text="Add Field"
                      minimal
                      fill
                      intent={Intent.PRIMARY}
                      onClick={() => handleAddField(editingIdx)}
                    />
                  </td>
                </tr>
              </tbody>
            </HTMLTable>
          )}
        </div>
        <Divider className="m-0" />
        <div className="p-3 bg-gray-100 dark:bg-bp-dark-header flex justify-end gap-2 rounded-b">
          <Button text="Done" intent={Intent.PRIMARY} onClick={() => setEditingIdx(null)} />
        </div>
      </Dialog>
    </>
  );
});
