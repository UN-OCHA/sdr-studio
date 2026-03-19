import { Button, EntityTitle, H3, Intent } from "@blueprintjs/core";
import { useRef } from "react";
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

  const getTitle = () => {
    switch (settingsSection) {
      case "profile":
        return "Project Profile";
      case "general":
        return "Intelligence Engine";
      case "library":
        return "Model Library";
      case "monitoring":
        return "Monitoring Station";
      case "export":
        return "Export Configuration";
      case "entities":
        return "Entity Labels";
      case "relations":
        return "Relations";
      case "classifications":
        return "Classifications";
      case "api":
        return "External API Access";
      default:
        return "Structured Objects";
    }
  };

  const getSubtitle = () => {
    switch (settingsSection) {
      case "profile":
        return "Identity and basic information.";
      case "general":
        return "Model and sensitivity parameters.";
      case "library":
        return "Manage trained LoRA adapters.";
      case "monitoring":
        return "Automated article discovery.";
      case "export":
        return "Configure how data is formatted for export.";
      case "api":
        return "Manage API keys for external report integration.";
      case "entities":
        return "Identify specific spans of text like locations, dates, or names.";
      case "relations":
        return "Extract relationships between recognized entities (e.g. 'victim_of').";
      case "classifications":
        return "Categorize the overall document into predefined buckets.";
      default:
        return "Define complex JSON structures for deep data extraction.";
    }
  };

  const canSave = () => {
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
  };

  const handleSave = () => {
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
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <EntityTitle title={getTitle()} subtitle={getSubtitle()} heading={H3} />
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
