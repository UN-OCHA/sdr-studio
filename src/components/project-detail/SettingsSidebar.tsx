import { Menu, MenuItem } from "@blueprintjs/core";
import type { SettingsSection } from "../../types";

type SettingsSidebarProps = {
  activeSection: SettingsSection;
  onChangeSection: (section: SettingsSection) => void;
};

export function SettingsSidebar({
  activeSection,
  onChangeSection,
}: SettingsSidebarProps) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 pl-2 tracking-wider">
          General
        </p>
        <Menu className="bg-transparent p-0">
          <MenuItem
            icon="info-sign"
            text="Project Profile"
            active={activeSection === "profile"}
            onClick={() => onChangeSection("profile")}
          />
          <MenuItem
            icon="predictive-analysis"
            text="Intelligence Engine"
            active={activeSection === "general"}
            onClick={() => onChangeSection("general")}
          />
          <MenuItem
            icon="box"
            text="Model Library"
            active={activeSection === "library"}
            onClick={() => onChangeSection("library")}
          />
        </Menu>
      </div>

      <div>
        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 pl-2 tracking-wider">
          Extraction Schema
        </p>
        <Menu className="bg-transparent p-0">
          <MenuItem
            icon="tag"
            text="Entity Labels"
            active={activeSection === "entities"}
            onClick={() => onChangeSection("entities")}
          />
          <MenuItem
            icon="link"
            text="Relations"
            active={activeSection === "relations"}
            onClick={() => onChangeSection("relations")}
          />
          <MenuItem
            icon="list-columns"
            text="Classifications"
            active={activeSection === "classifications"}
            onClick={() => onChangeSection("classifications")}
          />
          <MenuItem
            icon="layout-grid"
            text="Structured Objects"
            active={activeSection === "structures"}
            onClick={() => onChangeSection("structures")}
          />
        </Menu>
      </div>

      <div>
        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 pl-2 tracking-wider">
          Data Pipeline
        </p>
        <Menu className="bg-transparent p-0">
          <MenuItem
            icon="feed"
            text="Monitoring Station"
            active={activeSection === "monitoring"}
            onClick={() => onChangeSection("monitoring")}
          />
          <MenuItem
            icon="export"
            text="Export Configuration"
            active={activeSection === "export"}
            onClick={() => onChangeSection("export")}
          />
          <MenuItem
            icon="key"
            text="API Access"
            active={activeSection === "api"}
            onClick={() => onChangeSection("api")}
          />
        </Menu>
      </div>
    </div>
  );
}
