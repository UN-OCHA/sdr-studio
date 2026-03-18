import { Button, Intent, Section, SectionCard } from "@blueprintjs/core";
import { useState } from "react";
import type { Project } from "../../types";
import { ClassificationManager } from "./ClassificationManager";
import { LabelManager } from "./LabelManager";
import { RelationManager } from "./RelationManager";
import { StructureManager } from "./StructureManager";

type ExtractionSettingsProps = {
  config: Project["extraction_config"];
  onSave: (config: Project["extraction_config"]) => void;
  isSaving: boolean;
  hideHeader?: boolean;
};

export function ExtractionSettings({
  config,
  onSave,
  isSaving,
  hideHeader = false,
}: ExtractionSettingsProps) {
  const [localConfig, setLocalConfig] = useState(config);

  const handleUpdate = (updates: Partial<Project["extraction_config"]>) => {
    const next = { ...localConfig, ...updates };
    setLocalConfig(next);
    if (hideHeader) {
      // In onboarding, propagate changes immediately
      onSave(next);
    }
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold">Extraction Schema</h3>
            <p className="text-gray-500 text-sm">
              Configure how sources are analyzed.
            </p>
          </div>
          <Button
            intent={Intent.PRIMARY}
            icon="floppy-disk"
            text="Save Changes"
            loading={isSaving}
            onClick={() => onSave(localConfig)}
          />
        </div>
      )}

      <Section title="Entity Recognition" icon="tag">
        <SectionCard>
          <LabelManager
            labels={localConfig.entities || {}}
            onChange={(entities) => handleUpdate({ entities })}
          />
        </SectionCard>
      </Section>

      <Section title="Relations" icon="link">
        <SectionCard>
          <RelationManager
            relations={(localConfig.relations as Record<string, string>) || {}}
            onChange={(relations) => handleUpdate({ relations })}
          />
        </SectionCard>
      </Section>

      <Section title="Classifications" icon="list-columns">
        <SectionCard>
          <ClassificationManager
            classifications={localConfig.classifications || {}}
            onChange={(classifications) => handleUpdate({ classifications })}
          />
        </SectionCard>
      </Section>

      <Section title="Structured Data" icon="layout-grid">
        <SectionCard padded={false}>
          <StructureManager
            structures={localConfig.structures || []}
            onChange={(structures) => handleUpdate({ structures })}
          />
        </SectionCard>
      </Section>
    </div>
  );
}
