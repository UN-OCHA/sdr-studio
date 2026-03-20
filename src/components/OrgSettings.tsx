import { Button, EntityTitle, H5, Icon, Menu, MenuItem } from "@blueprintjs/core";
import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { SettingsSection } from "../types";
import { MemberManager } from "./org-settings/MemberManager";
import { OrgProfile } from "./org-settings/OrgProfile";

type OrgSettingsProps = {
  onBack: () => void;
  initialSection?: SettingsSection;
};

export function OrgSettings({ onBack, initialSection = "org-members" }: OrgSettingsProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);

  const getTitle = () => {
    switch (activeSection) {
      case "org-profile":
        return "Organization Profile";
      case "org-members":
        return "Member Management";
      default:
        return "Organization Settings";
    }
  };

  const getSubtitle = () => {
    switch (activeSection) {
      case "org-profile":
        return "Basic info and branding for your organization.";
      case "org-members":
        return "Manage team members and their access levels.";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-bp-dark-bg">
      {/* Header */}
      <div className="h-12 shrink-0 flex items-center px-3 border-b border-gray-200 dark:border-bp-dark-border bg-gray-50 dark:bg-bp-dark-surface gap-1 shadow-sm z-10">
        <Button icon="arrow-left" onClick={onBack} minimal small />
        <Icon icon="cog" size={18} className="text-gray-500 dark:text-gray-400 ml-1" />
        <EntityTitle 
          title="Organization Settings" 
          subtitle="Manage your team and enterprise integrations" 
          heading={H5}
          className="ml-1"
        />
      </div>

      <PanelGroup direction="horizontal" className="grow overflow-hidden">
        {/* Sidebar */}
        <Panel
          defaultSize={25}
          minSize={20}
          maxSize={40}
          className="flex flex-col bg-gray-50 dark:bg-bp-dark-surface border-r border-gray-200 dark:border-bp-dark-border"
        >
          <div className="p-4 space-y-4">
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold mb-2 pl-2 tracking-wider">
                Identity
              </p>
              <Menu className="bg-transparent p-0">
                <MenuItem
                  icon="office"
                  text="Org Profile"
                  active={activeSection === "org-profile"}
                  onClick={() => setActiveSection("org-profile")}
                />
                <MenuItem
                  icon="people"
                  text="Members"
                  active={activeSection === "org-members"}
                  onClick={() => setActiveSection("org-members")}
                />
              </Menu>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-gray-100 dark:bg-bp-dark-header hover:bg-blue-200 transition-colors border-x border-gray-200 dark:border-bp-dark-border flex items-center justify-center group cursor-col-resize">
            <div className="w-0.5 h-8 bg-gray-300 group-hover:bg-blue-400 rounded-full" />
        </PanelResizeHandle>

        {/* Content */}
        <Panel className="bg-white dark:bg-bp-dark-bg flex flex-col overflow-hidden">
          <div className="grow overflow-y-auto p-6">
            <div className="mx-auto">
              {activeSection === "org-members" && <MemberManager title={getTitle()} subtitle={getSubtitle()} />}
              {activeSection !== "org-members" && (
                <>
                  <div className="mb-6">
                    <EntityTitle title={getTitle()} subtitle={getSubtitle()} heading={H5} />
                  </div>
                  {activeSection === "org-profile" && <OrgProfile />}
                </>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
