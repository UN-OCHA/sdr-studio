import {
  Button,
  Card,
  Dialog,
  EntityTitle,
  FormGroup,
  H3,
  H5,
  Icon,
  InputGroup,
  Intent,
  MenuItem,
  NonIdealState,
  Spinner,
  TextArea,
  type IconName,
} from "@blueprintjs/core";
import { Select, type ItemRenderer } from "@blueprintjs/select";
import { useEffect, useState } from "react";
import TimeAgo from "react-timeago";
import { templatesApi } from "../api";
import type { Project, ProjectCreate, ProjectTemplate } from "../types";
import { IconPicker } from "./IconPicker";

type DashboardProps = {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onCreateProject: (project: ProjectCreate) => void;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
};

export function Dashboard({
  projects,
  isLoading,
  error,
  onRetry,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
}: DashboardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    icon: "briefcase",
  });

  useEffect(() => {
    if (isDialogOpen) {
      void templatesApi.list().then(setTemplates);
    }
  }, [isDialogOpen]);

  const handleCreate = () => {
    if (!newProject.name) return;

    const template = templates.find((t) => t.id === selectedTemplateId);

    onCreateProject({
      name: newProject.name,
      description: newProject.description,
      icon: template?.icon || newProject.icon,
      extraction_config: template?.extraction_config,
    });
    setIsDialogOpen(false);
    setNewProject({ name: "", description: "", icon: "briefcase" });
    setSelectedTemplateId("none");
  };

  const renderTemplateOption: ItemRenderer<
    | ProjectTemplate
    | { id: string; name: string; icon: string; description: string }
  > = (option, { handleClick, handleFocus, modifiers }) => {
    if (!modifiers.matchesPredicate) return null;
    return (
      <MenuItem
        active={modifiers.active}
        disabled={modifiers.disabled}
        key={option.id}
        onClick={handleClick}
        onFocus={handleFocus}
        text={
          <div className="flex flex-col py-0.5">
            <span className="font-semibold text-xs">{option.name}</span>
            <span className="text-[10px] text-gray-500 font-normal leading-tight">
              {option.description}
            </span>
          </div>
        }
        icon={option.icon as IconName}
      />
    );
  };

  const selectedTemplate =
    selectedTemplateId === "none"
      ? {
          id: "none",
          name: "Blank (No Template)",
          icon: "blank",
          description: "Start from scratch.",
        }
      : templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="mx-auto h-full">
      <div className="flex justify-between items-center mb-6">
        <EntityTitle
          title="Projects"
          subtitle="Manage your monitoring and analysis projects."
          heading={H3}
        />
        <Button
          intent={Intent.PRIMARY}
          icon="plus"
          text="New Project"
          onClick={() => setIsDialogOpen(true)}
        />
      </div>

      {isLoading && projects.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <Spinner size={50} />
        </div>
      ) : error && projects.length === 0 ? (
        <NonIdealState
          icon="offline"
          title="Backend Connection Error"
          description={error}
          className="h-full"
          action={
            <Button
              intent={Intent.PRIMARY}
              icon="refresh"
              text="Retry Connection"
              onClick={onRetry}
            />
          }
        />
      ) : projects.length === 0 ? (
        <NonIdealState
          icon="projects"
          title="No Projects Yet"
          description="Create your first project to start importing and analyzing disaster-related news articles."
          className="h-full"
          action={
            <Button
              intent={Intent.PRIMARY}
              icon="plus"
              text="New Project"
              onClick={() => setIsDialogOpen(true)}
            />
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card
              key={project.id}
              interactive
              onClick={() => onSelectProject(project.id)}
              className="h-28 flex flex-col justify-between relative group"
            >
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="minimal"
                  size="small"
                  icon="trash"
                  intent={Intent.DANGER}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      confirm("Are you sure you want to delete this project?")
                    ) {
                      onDeleteProject(project.id);
                    }
                  }}
                />
              </div>
              <div className="flex gap-3">
                <Icon
                  icon={project.icon as IconName}
                  size={24}
                  className="mt-1 text-gray-400"
                />
                <EntityTitle
                  title={project.name}
                  subtitle={project.description || "No description provided."}
                  heading={H5}
                />
              </div>
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>
                  Created <TimeAgo date={`${project.created_at}Z`} />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="New Project"
      >
        <div className="p-6">
          <FormGroup label="Inherit from Template">
            <Select<
              | ProjectTemplate
              | { id: string; name: string; icon: string; description: string }
            >
              items={[
                {
                  id: "none",
                  name: "Blank (No Template)",
                  icon: "blank",
                  description: "Start from scratch.",
                },
                ...templates,
              ]}
              itemRenderer={renderTemplateOption}
              onItemSelect={(t) => setSelectedTemplateId(t.id)}
              filterable={false}
              popoverProps={{ minimal: true, matchTargetWidth: true }}
            >
              <Button
                fill
                text={selectedTemplate?.name || "Select Template..."}
                rightIcon="caret-down"
                icon={selectedTemplate?.icon as IconName}
                alignText="left"
              />
            </Select>
          </FormGroup>
          <FormGroup
            label="Project Name"
            labelFor="name"
            labelInfo="(required)"
          >
            <InputGroup
              id="name"
              placeholder="E.g. Gezani Cyclone 2026"
              value={newProject.name}
              onChange={(e) =>
                setNewProject({ ...newProject, name: e.target.value })
              }
            />
          </FormGroup>
          <FormGroup label="Project Icon">
            <IconPicker
              selectedIcon={newProject.icon}
              onSelect={(icon) => setNewProject({ ...newProject, icon })}
            />
          </FormGroup>
          <FormGroup label="Description" labelFor="description">
            <TextArea
              id="description"
              fill
              placeholder="Describe the purpose of this project..."
              value={newProject.description}
              onChange={(e) =>
                setNewProject({ ...newProject, description: e.target.value })
              }
            />
          </FormGroup>
          <div className="flex justify-end gap-2 mt-4">
            <Button text="Cancel" onClick={() => setIsDialogOpen(false)} />
            <Button
              intent={Intent.PRIMARY}
              text="Create Project"
              onClick={handleCreate}
              disabled={!newProject.name.trim()}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
