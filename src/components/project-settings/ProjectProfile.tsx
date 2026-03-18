import {
  FormGroup,
  InputGroup,
  Section,
  SectionCard,
  TextArea,
} from "@blueprintjs/core";
import { useEffect, useState } from "react";
import type { Project } from "../../types";
import { IconPicker } from "../IconPicker";

type ProjectProfileProps = {
  project: Project;
  onChange: (updates: Partial<Project>) => void;
};

export function ProjectProfile({ project, onChange }: ProjectProfileProps) {
  const [localName, setLocalName] = useState(project.name);
  const [localDescription, setLocalDescription] = useState(project.description);
  const [localIcon, setLocalIcon] = useState(project.icon);

  // Sync with project prop if it changes externally
  useEffect(() => {
    Promise.resolve().then(() => {
      setLocalName(project.name);
      setLocalDescription(project.description);
      setLocalIcon(project.icon);
    });
  }, [project.name, project.description, project.icon]);

  // Notify parent of changes immediately for Icon (since it's a dropdown selection)
  // but keep text fields local until manual save or based on parent strategy.
  // Actually, to follow "Save Settings" pattern, we should probably just notify 
  // on every change but the PARENT should decide when to sync to DB.
  // However, the user asked to NOT save on character entry.
  
  const handleNameChange = (name: string) => {
    setLocalName(name);
    onChange({ name, description: localDescription, icon: localIcon });
  };

  const handleDescriptionChange = (description: string) => {
    setLocalDescription(description);
    onChange({ name: localName, description, icon: localIcon });
  };

  const handleIconChange = (icon: string) => {
    setLocalIcon(icon);
    onChange({ name: localName, description: localDescription, icon });
  };

  return (
    <div className="space-y-6">
      <Section title="Project Profile" icon="info-sign">
        <SectionCard>
          <FormGroup label="Project Name" labelInfo="(Required)">
            <InputGroup 
              value={localName} 
              onChange={(e) => handleNameChange(e.target.value)} 
            />
          </FormGroup>
          <FormGroup label="Project Icon" helperText="Choose an icon to identify this project.">
            <IconPicker 
              selectedIcon={localIcon} 
              onSelect={handleIconChange} 
            />
          </FormGroup>
          <FormGroup label="Description">
            <TextArea 
              fill 
              rows={4}
              placeholder="Describe the objective of this monitoring project..."
              value={localDescription} 
              onChange={(e) => handleDescriptionChange(e.target.value)} 
            />
          </FormGroup>
        </SectionCard>
      </Section>
    </div>
  );
}
