import { Button, Menu, MenuItem, Popover } from "@blueprintjs/core";
import { projectsApi } from "../../api";
import type { Project } from "../../types";

type SidebarExportDockProps = {
  project: Project;
};

export function SidebarExportDock({ project }: SidebarExportDockProps) {
  return (
    <div className="p-1.5 border-t border-gray-200 bg-white">
      <Popover
        minimal
        content={
          <Menu>
            <MenuItem
              icon="document"
              text="Export as JSON"
              onClick={async () => {
                const { token } = await projectsApi.getExportToken();
                window.open(
                  projectsApi.exportJsonUrl(project.id, token),
                  "_blank",
                );
              }}
            />
            <MenuItem
              icon="th"
              text="Export as CSV"
              onClick={async () => {
                const { token } = await projectsApi.getExportToken();
                window.open(
                  projectsApi.exportCsvUrl(project.id, token),
                  "_blank",
                );
              }}
            />
            <MenuItem
              icon="print"
              text="Generate Report (MD)"
              onClick={async () => {
                const { token } = await projectsApi.getExportToken();
                window.open(
                  projectsApi.exportReportUrl(project.id, token, "md"),
                  "_blank",
                );
              }}
            />
          </Menu>
        }
        position="top"
        fill
      >
        <Button
          fill
          intent="primary"
          variant="outlined"
          icon="cloud-download"
          text="Export Data"
          endIcon="caret-up"
        />
      </Popover>
    </div>
  );
}
