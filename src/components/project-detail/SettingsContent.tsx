import { Button, EntityTitle, H3, Intent } from "@blueprintjs/core";
import { useCallback, useRef } from "react";
import type { Project, ProjectStats, SettingsSection } from "../../types";
import type { MonitoringStationRef } from "../MonitoringStation";
import { MonitoringStation } from "../MonitoringStation";
import { ApiKeyManager } from "../project-settings/ApiKeyManager";
import { ExportSettings } from "../project-settings/ExportSettings";
import { ExtractionSettings } from "../project-settings/ExtractionSettings";
import { GeneralSettings } from "../project-settings/GeneralSettings";
import { ModelLibrary } from "../project-settings/ModelLibrary";
import { ProjectProfile } from "../project-settings/ProjectProfile";

type SettingsContentProps = {
  project: Project;
  stats: ProjectStats | null;
  settingsSection: SettingsSection;
  isSaving: boolean;
  pendingConfig: Project["extraction_config"] | null;
  pendingExportConfig: Project["export_config"] | null;
  pendingProjectUpdates: Partial<Project>;
  onSaveConfig: (
    newConfig: Project["extraction_config"],
    newExportConfig?: Project["export_config"],
  ) => void;
  onUpdateProjectDetails: (updates: Partial<Project>) => void;
  onProjectUpdate: (project: Project) => void;
  onPendingConfigChange: (config: Project["extraction_config"] | null) => void;
  onPendingExportConfigChange: (
    config: Project["export_config"] | null,
  ) => void;
  onPendingProjectUpdatesChange: (updates: Partial<Project>) => void;
};

const SECTION_TITLES: Partial<Record<SettingsSection, string>> = {
  profile: "Project Profile",
  general: "Intelligence Engine",
  library: "Model Library",
  monitoring: "Monitoring Station",
  export: "Export Configuration",
  entities: "Entity Labels",
  relations: "Relations",
  classifications: "Classifications",
  api: "External API Access",
};

const SECTION_SUBTITLES: Partial<Record<SettingsSection, string>> = {
  profile: "Identity and basic information.",
  general: "Model and sensitivity parameters.",
  library: "Manage trained LoRA adapters.",
  monitoring: "Automated article discovery.",
  export: "Configure how data is formatted for export.",
  api: "Manage API keys for external report integration.",
  entities: "Identify specific spans of text like locations, dates, or names.",
  relations: "Extract relationships between recognized entities (e.g. 'victim_of').",
  classifications: "Categorize the overall document into predefined buckets.",
};

export function SettingsContent({
  project,
  settingsSection,
  isSaving,
  pendingConfig,
  pendingExportConfig,
  pendingProjectUpdates,
  onSaveConfig,
  onUpdateProjectDetails,
  onProjectUpdate,
  onPendingConfigChange,
  onPendingExportConfigChange,
  onPendingProjectUpdatesChange,
}: SettingsContentProps) {
  const monitoringRef = useRef<MonitoringStationRef>(null);

  const title = SECTION_TITLES[settingsSection] || "Structured Objects";
  const subtitle = SECTION_SUBTITLES[settingsSection] || "Define complex JSON structures for deep data extraction.";

  const canSave = useCallback(() => {
    if (
      [
        "entities",
        "relations",
        "classifications",
        "structures",
        "general",
      ].includes(settingsSection)
    ) {
      return !!pendingConfig;
    }
    if (settingsSection === "export") {
      return !!pendingExportConfig;
    }
    if (settingsSection === "profile") {
      return Object.keys(pendingProjectUpdates).length > 0;
    }
    return false;
  }, [settingsSection, pendingConfig, pendingExportConfig, pendingProjectUpdates]);

  const handleSave = useCallback(() => {
    if (
      [
        "entities",
        "relations",
        "classifications",
        "structures",
        "general",
      ].includes(settingsSection)
    ) {
      if (pendingConfig) {
        onSaveConfig(pendingConfig);
      }
    } else if (settingsSection === "export") {
      if (pendingExportConfig) {
        onSaveConfig(project.extraction_config, pendingExportConfig);
      }
    } else if (settingsSection === "profile") {
      onUpdateProjectDetails(pendingProjectUpdates);
      onPendingProjectUpdatesChange({});
    }
  }, [
    settingsSection,
    pendingConfig,
    pendingExportConfig,
    pendingProjectUpdates,
    project.extraction_config,
    onSaveConfig,
    onUpdateProjectDetails,
    onPendingProjectUpdatesChange,
  ]);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <EntityTitle title={title} subtitle={subtitle} heading={H3} />
        <div className="flex gap-2">
          {settingsSection === "monitoring" && (
            <Button
              intent={Intent.PRIMARY}
              icon="plus"
              text="Add Source"
              onClick={() => monitoringRef.current?.openAddSource()}
            />
          )}
          {!["library", "monitoring", "api"].includes(settingsSection) && (
            <Button
              intent={Intent.PRIMARY}
              icon="floppy-disk"
              text="Save Settings"
              loading={isSaving}
              onClick={handleSave}
              disabled={!canSave()}
            />
          )}
        </div>
      </div>

      {settingsSection === "profile" && (
        <ProjectProfile
          project={{ ...project, ...pendingProjectUpdates }}
          onChange={(updates) =>
            onPendingProjectUpdatesChange({
              ...pendingProjectUpdates,
              ...updates,
            })
          }
        />
      )}

      {settingsSection === "general" && (
        <GeneralSettings
          config={pendingConfig || project.extraction_config}
          onUpdateConfig={(updates) =>
            onPendingConfigChange({
              ...(pendingConfig || project.extraction_config),
              ...updates,
            })
          }
        />
      )}

      {settingsSection === "library" && (
        <ModelLibrary project={project} onProjectUpdate={onProjectUpdate} />
      )}

      {["entities", "relations", "classifications", "structures"].includes(
        settingsSection,
      ) && (
        <ExtractionSettings
          config={pendingConfig || project.extraction_config}
          onChange={onPendingConfigChange}
          isSaving={isSaving}
          hideHeader
          initialSection={settingsSection as any}
        />
      )}

      {settingsSection === "monitoring" && (
        <MonitoringStation project={project} ref={monitoringRef} />
      )}

      {settingsSection === "export" && (
        <ExportSettings
          projectId={project.id}
          config={pendingExportConfig || project.export_config}
          extractionConfig={project.extraction_config}
          onChange={onPendingExportConfigChange}
          hideHeader
        />
      )}

      {settingsSection === "api" && <ApiKeyManager project={project} />}
    </div>
  );
}
