import {
  Button,
  Card,
  Dialog,
  EntityTitle,
  FormGroup,
  H3,
  H5,
  Icon,
  type IconName,
  InputGroup,
  Intent,
  NonIdealState,
  TextArea,
} from "@blueprintjs/core";
import { useState } from "react";
import TimeAgo from "react-timeago";
import type { Project, ProjectCreate } from "../types";
import { IconPicker } from "./IconPicker";

type DashboardProps = {
  projects: Project[];
  onCreateProject: (project: ProjectCreate) => void;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
};

export function Dashboard({
  projects,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
}: DashboardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    icon: "briefcase",
  });

  const handleCreate = () => {
    if (!newProject.name) return;
    onCreateProject({
      name: newProject.name,
      description: newProject.description,
      icon: newProject.icon,
    });
    setIsDialogOpen(false);
    setNewProject({ name: "", description: "", icon: "briefcase" });
  };

  return (
    <div className="mx-auto h-full">
      <div className="flex justify-between items-center mb-2">
        <H3>Projects</H3>
        <Button
          intent={Intent.PRIMARY}
          icon="plus"
          text="New Project"
          onClick={() => setIsDialogOpen(true)}
        />
      </div>

      {projects.length === 0 ? (
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
