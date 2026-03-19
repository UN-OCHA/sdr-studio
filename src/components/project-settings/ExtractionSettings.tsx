import {
  Button,
  CardList,
  EntityTitle,
  H3,
  H5,
  Intent,
  Section,
  SectionCard,
} from "@blueprintjs/core";
import { useState, useRef, useEffect } from "react";
import type { Project } from "../../types";
import { ClassificationManager } from "./ClassificationManager";
import { LabelManager } from "./LabelManager";
import { RelationManager } from "./RelationManager";
import { StructureManager } from "./StructureManager";

type ExtractionSettingsProps = {
  config: Project["extraction_config"];
  onSave?: (config: Project["extraction_config"]) => void;
  onChange?: (config: Project["extraction_config"]) => void;
  isSaving?: boolean;
  hideHeader?: boolean;
};

export function ExtractionSettings({
  config,
  onSave,
  onChange,
  isSaving,
  hideHeader = false,
}: ExtractionSettingsProps) {
  const [localConfig, setLocalConfig] = useState(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const labelManagerRef = useRef<{ openAdd: () => void }>(null);
  const relationManagerRef = useRef<{ openAdd: () => void }>(null);
  const classificationManagerRef = useRef<{ openAdd: () => void }>(null);
  const structureManagerRef = useRef<{ openAdd: () => void }>(null);

  const handleUpdate = (updates: Partial<Project["extraction_config"]>) => {
    const next = { ...localConfig, ...updates };
    setLocalConfig(next);
    if (onChange) {
      onChange(next);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {!hideHeader && (
        <div className="flex justify-between items-center mb-4">
          <EntityTitle
            title="Extraction Schema"
            subtitle="Configure how news articles are analyzed and data is extracted."
            heading={H3}
          />
          <Button
            intent={Intent.PRIMARY}
            icon="floppy-disk"
            text="Save Changes"
            loading={isSaving}
            onClick={() => onSave?.(localConfig)}
          />
        </div>
      )}

      <Section
        title={
          <EntityTitle
            title="Entity Labels"
            subtitle="Identify specific spans of text like locations, dates, or names."
            heading={H5}
          />
        }
        icon="tag"
        collapsible={false}
        rightElement={
          <Button
            intent={Intent.PRIMARY}
            icon="plus"
            text="Add Entity"
            onClick={() => labelManagerRef.current?.openAdd()}
            minimal
            small
          />
        }
      >
        <SectionCard padded={false}>
          <CardList>
            <LabelManager
              ref={labelManagerRef}
              labels={localConfig.entities || {}}
              onChange={(entities) => handleUpdate({ entities })}
            />
          </CardList>
        </SectionCard>
      </Section>

      <Section
        title={
          <EntityTitle
            title="Relations"
            subtitle="Extract relationships between recognized entities (e.g. 'victim_of')."
            heading={H5}
          />
        }
        icon="link"
        collapsible={false}
        rightElement={
          <Button
            intent={Intent.PRIMARY}
            icon="plus"
            text="Add Relation"
            onClick={() => relationManagerRef.current?.openAdd()}
            minimal
            small
          />
        }
      >
        <SectionCard padded={false}>
          <CardList>
            <RelationManager
              ref={relationManagerRef}
              relations={(localConfig.relations as Record<string, string>) || {}}
              onChange={(relations) => handleUpdate({ relations })}
            />
          </CardList>
        </SectionCard>
      </Section>

      <Section
        title={
          <EntityTitle
            title="Classifications"
            subtitle="Categorize the overall document into predefined buckets."
            heading={H5}
          />
        }
        icon="list-columns"
        collapsible={false}
        rightElement={
          <Button
            intent={Intent.PRIMARY}
            icon="plus"
            text="Add Classification"
            onClick={() => classificationManagerRef.current?.openAdd()}
            minimal
            small
          />
        }
      >
        <SectionCard padded={false}>
          <CardList>
            <ClassificationManager
              ref={classificationManagerRef}
              classifications={localConfig.classifications || {}}
              onChange={(classifications) => handleUpdate({ classifications })}
            />
          </CardList>
        </SectionCard>
      </Section>

      <Section
        title={
          <EntityTitle
            title="Structured Objects"
            subtitle="Define complex JSON structures for deep data extraction."
            heading={H5}
          />
        }
        icon="layout-grid"
        collapsible={false}
        rightElement={
          <Button
            intent={Intent.PRIMARY}
            icon="plus"
            text="Add Object"
            onClick={() => structureManagerRef.current?.openAdd()}
            minimal
            small
          />
        }
      >
        <SectionCard padded={false}>
          <CardList>
            <StructureManager
              ref={structureManagerRef}
              structures={localConfig.structures || []}
              onChange={(structures) => handleUpdate({ structures })}
            />
          </CardList>
        </SectionCard>
      </Section>
    </div>
  );
}
