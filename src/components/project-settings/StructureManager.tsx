import {
  Button,
  ControlGroup,
  HTMLSelect,
  HTMLTable,
  InputGroup,
  Intent,
  Tag,
  TextArea,
} from "@blueprintjs/core";
import { useState } from "react";

type Field = {
  name: string;
  dtype: "str" | "int" | "float" | "bool" | "list";
  choices?: string[];
  description?: string;
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

export function StructureManager({
  structures,
  onChange,
}: StructureManagerProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(
    structures.length > 0 ? 0 : -1,
  );
  const [newStructName, setNewStructName] = useState("");

  const handleAddStructure = () => {
    if (
      newStructName.trim() &&
      !structures.find((s) => s.name === newStructName.trim())
    ) {
      const next = [...structures, { name: newStructName.trim(), fields: [] }];
      onChange(next);
      setNewStructName("");
      setSelectedIdx(next.length - 1);
    }
  };

  const handleRemoveStructure = (index: number) => {
    const next = [...structures];
    next.splice(index, 1);
    onChange(next);
    if (selectedIdx >= next.length) {
      setSelectedIdx(next.length - 1);
    }
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

  const handleAddField = (structIdx: number) => {
    const next = [...structures];
    next[structIdx].fields.push({
      name: `field_${next[structIdx].fields.length + 1}`,
      dtype: "str",
      description: "",
    });
    onChange(next);
  };

  const handleRemoveField = (structIdx: number, fieldIdx: number) => {
    const next = [...structures];
    next[structIdx].fields.splice(fieldIdx, 1);
    onChange(next);
  };

  const current = selectedIdx !== -1 ? structures[selectedIdx] : null;

  return (
    <div className="flex h-[500px] border border-gray-200 bg-white">
      {/* Sidebar: Minimal utility look */}
      <div className="w-44 flex flex-col border-r border-gray-200 bg-gray-50">
        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Objects</span>
          <Button icon="plus" minimal small onClick={() => setNewStructName("Object")} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {structures.map((s, idx) => (
            <div
              key={s.name}
              onClick={() => setSelectedIdx(idx)}
              className={`flex items-center justify-between px-3 py-1.5 cursor-pointer border-b border-gray-100 ${
                selectedIdx === idx
                  ? "bg-white text-blue-600 font-bold border-r-2 border-r-blue-500 shadow-[inset_0_0_10px_rgba(0,0,0,0.02)]"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span className="text-xs truncate">{s.name}</span>
              {selectedIdx === idx && (
                <Button
                  icon="small-cross"
                  minimal
                  small
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveStructure(idx);
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="p-1 border-t border-gray-200">
          <ControlGroup fill>
            <InputGroup
              small
              placeholder="Name..."
              value={newStructName}
              onChange={(e) => setNewStructName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddStructure()}
            />
            <Button icon="add" small onClick={handleAddStructure} />
          </ControlGroup>
        </div>
      </div>

      {/* Main Area: DevTools style high-density table */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {current ? (
          <>
            <div className="p-2 border-b border-gray-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-tight">{current.name}</span>
                <Tag minimal round className="text-[9px] py-0 h-4">
                  {current.fields.length}
                </Tag>
              </div>
              <Button
                icon="plus"
                text="Add Field"
                small
                intent={Intent.PRIMARY}
                onClick={() => handleAddField(selectedIdx)}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              <HTMLTable className="w-full" striped bordered={false}>
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-[9px] uppercase text-gray-400 font-bold border-b border-gray-200">Field Name</th>
                    <th className="w-24 p-2 text-[9px] uppercase text-gray-400 font-bold border-b border-gray-200">Type</th>
                    <th className="w-40 p-2 text-[9px] uppercase text-gray-400 font-bold border-b border-gray-200">Regex</th>
                    <th className="p-2 text-[9px] uppercase text-gray-400 font-bold border-b border-gray-200">Extraction Description</th>
                    <th className="w-8 p-2 border-b border-gray-200"></th>
                  </tr>
                </thead>
                <tbody>
                  {current.fields.map((f, fIdx) => (
                    <tr key={fIdx} className="align-top">
                      <td className="p-1">
                        <InputGroup
                          small
                          asyncControl
                          className="font-bold text-blue-800"
                          value={f.name}
                          onChange={(e) => handleUpdateField(selectedIdx, fIdx, { name: e.target.value })}
                        />
                      </td>
                      <td className="p-1">
                        <HTMLSelect
                          fill
                          value={f.dtype}
                          onChange={(e) => handleUpdateField(selectedIdx, fIdx, { dtype: e.target.value as "str" | "int" | "float" | "bool" | "list" })}
                        >
                          <option value="str">str</option>
                          <option value="int">int</option>
                          <option value="float">float</option>
                          <option value="bool">bool</option>
                          <option value="list">list</option>
                        </HTMLSelect>
                      </td>
                      <td className="p-1">
                        <InputGroup
                          small
                          asyncControl
                          placeholder="^\d+$"
                          className="font-mono text-[10px]"
                          value={f.validator_pattern || ""}
                          onChange={(e) => handleUpdateField(selectedIdx, fIdx, { validator_pattern: e.target.value })}
                        />
                      </td>
                      <td className="p-0.5">
                        <TextArea
                          fill
                          autoResize
                          placeholder="Hints for the extractor..."
                          value={f.description || ""}
                          onChange={(e) =>
                            handleUpdateField(selectedIdx, fIdx, {
                              description: e.target.value,
                            })
                          }
                          className="text-[11px] min-h-[30px]!"
                        />
                      </td>
                      <td className="p-1 text-center">
                        <Button
                          icon="cross"
                          minimal
                          small
                          onClick={() => handleRemoveField(selectedIdx, fIdx)}
                        />
                      </td>
                    </tr>
                  ))}
                  {current.fields.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 italic text-xs">
                        No fields defined.
                      </td>
                    </tr>
                  )}
                </tbody>
              </HTMLTable>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 italic text-xs">
            Select an object to define its schema.
          </div>
        )}
      </div>
    </div>
  );
}
