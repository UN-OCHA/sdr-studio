import {
  Button,
  Callout,
  Card,
  Elevation,
  EntityTitle,
  FormGroup,
  H3,
  HTMLTable,
  Icon,
  type IconName,
  InputGroup,
  Intent,
  NonIdealState,
  Section,
  SectionCard,
  Spinner,
  TextArea,
} from "@blueprintjs/core";
import { useCallback, useEffect, useState } from "react";
import { templatesApi } from "../api";
import { useToaster } from "../hooks/useToaster";
import type { ProjectTemplate, ProjectTemplateCreate } from "../types";
import { IconPicker } from "./IconPicker";
import { ExtractionSettings } from "./project-settings/ExtractionSettings";
import { ExportSettings } from "./project-settings/ExportSettings";

export function TemplateManager() {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<ProjectTemplate | null>(null);

  const [formData, setFormData] = useState<ProjectTemplateCreate>({
    name: "",
    description: "",
    icon: "cube",
    extraction_config: {},
    export_config: { fields: [] },
  });
  const { showToaster } = useToaster();

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await templatesApi.list();
      setTemplates(data);
    } catch {
      showToaster("Failed to fetch templates", Intent.DANGER);
    } finally {
      setIsLoading(false);
    }
  }, [showToaster]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSave = async (
    config?: ProjectTemplate["extraction_config"],
    export_config?: ProjectTemplate["export_config"],
  ) => {
    if (!formData.name) return;
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        extraction_config: config || formData.extraction_config,
        export_config: export_config || formData.export_config,
      };

      if (editingTemplate && editingTemplate.id !== "new") {
        await templatesApi.update(editingTemplate.id, payload);
        showToaster("Template updated", Intent.SUCCESS);
      } else {
        await templatesApi.create(payload);
        showToaster("Template created", Intent.SUCCESS);
      }
      setEditingTemplate(null);
      fetchTemplates();
    } catch {
      showToaster("Failed to save template", Intent.DANGER);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await templatesApi.delete(id);
      showToaster("Template deleted", Intent.SUCCESS);
      fetchTemplates();
    } catch {
      showToaster("Failed to delete template", Intent.DANGER);
    }
  };

  const openCreate = () => {
    setFormData({
      name: "",
      description: "",
      icon: "cube",
      extraction_config: { entities: {} },
      export_config: { fields: [] },
    });
    setEditingTemplate({ 
      id: "new",
      name: "",
      description: "",
      icon: "cube",
      extraction_config: { entities: {} },
      export_config: { fields: [] },
      org_id: "",
      created_at: new Date().toISOString()
    } as ProjectTemplate);
  };

  const openEdit = (template: ProjectTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      icon: template.icon,
      extraction_config: template.extraction_config,
      export_config: template.export_config || { fields: [] },
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Spinner />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading templates...</p>
      </div>
    );
  }

  if (editingTemplate) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              icon="arrow-left"
              onClick={() => setEditingTemplate(null)}
              variant="minimal"
            />
            <EntityTitle
              title={
                editingTemplate.id === "new"
                  ? "New Template"
                  : `Edit Template: ${formData.name}`
              }
              subtitle="Manage template metadata and extraction schema."
              heading={H3}
            />
          </div>
          <Button
            intent={Intent.PRIMARY}
            icon="floppy-disk"
            text="Save Template"
            loading={isSaving}
            onClick={() => handleSave()}
            disabled={!formData.name}
          />
        </div>

        <div className="space-y-8">
          <Section title="General Information" icon="info-sign">
            <SectionCard className="space-y-4">
              <FormGroup label="Template Name" labelInfo="(required)">
                <InputGroup
                  placeholder="e.g. Natural Disaster"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </FormGroup>
              <FormGroup label="Description">
                <TextArea
                  fill
                  placeholder="What is this template for?"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </FormGroup>
              <FormGroup label="Icon">
                <IconPicker
                  selectedIcon={formData.icon || "cube"}
                  onSelect={(icon) => setFormData((prev) => ({ ...prev, icon }))}
                />
              </FormGroup>
            </SectionCard>
          </Section>

          <ExtractionSettings
            config={formData.extraction_config || { entities: {} }}
            onSave={(config) => handleSave(config)}
            isSaving={isSaving}
          />

          <ExportSettings
            config={formData.export_config || { fields: [] }}
            extractionConfig={formData.extraction_config || {}}
            onChange={(export_config) => setFormData((prev) => ({ ...prev, export_config }))}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <EntityTitle
          title="Project Templates"
          subtitle="Define reusable extraction schemas and settings for your organization."
          heading={H3}
        />
        <Button
          intent={Intent.PRIMARY}
          icon="plus"
          text="New Template"
          onClick={openCreate}
        />
      </div>

      <Callout intent={Intent.PRIMARY} icon="info-sign" className="mb-6">
        Templates allow you to standardize how different types of disasters or
        events are monitored. When creating a new project, you can choose a
        template to automatically set up its extraction schema.
      </Callout>

      {templates.length === 0 ? (
        <NonIdealState
          icon="cube"
          title="No Templates"
          description="Create templates to standardize your organization's monitoring projects."
          action={
            <Button
              intent={Intent.PRIMARY}
              icon="plus"
              text="New Template"
              onClick={openCreate}
            />
          }
        />
      ) : (
        <Card elevation={Elevation.ONE} className="p-0 overflow-hidden">
          <HTMLTable striped interactive className="w-full">
            <thead>
              <tr>
                <th className="w-10">Icon</th>
                <th>Name</th>
                <th>Description</th>
                <th>Entities</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} onClick={() => openEdit(t)}>
                  <td>
                    <Icon icon={t.icon as IconName} className="text-gray-500 dark:text-gray-400" />
                  </td>
                  <td className="font-bold">{t.name}</td>
                  <td className="text-sm text-gray-500 dark:text-gray-400">{t.description}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(t.extraction_config?.entities || {}).map(
                        (label) => (
                          <span
                            key={label}
                            className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-xs border border-blue-100 dark:border-blue-900/50"
                          >
                            {label}
                          </span>
                        ),
                      )}
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        minimal
                        small
                        icon="edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(t);
                        }}
                      />
                      <Button
                        minimal
                        small
                        intent={Intent.DANGER}
                        icon="trash"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(t.id);
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </Card>
      )}
    </div>
  );
}
