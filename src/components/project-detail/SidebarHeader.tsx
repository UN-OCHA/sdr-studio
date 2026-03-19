import { Button, H5, Icon, Tab, Tabs, type IconName } from "@blueprintjs/core";
import type { Project } from "../../types";

type SidebarHeaderProps = {
  project: Project;
  activeTab: "home" | "articles" | "settings";
  articlesCount: number;
  onBack: () => void;
  onTabChange: (tab: "home" | "articles" | "settings") => void;
};

export function SidebarHeader({
  project,
  activeTab,
  articlesCount,
  onBack,
  onTabChange,
}: SidebarHeaderProps) {
  return (
    <div className="p-2 border-b border-gray-200 bg-white">
      <div className="flex flex-row items-center gap-1 mb-1">
        <Button icon="arrow-left" onClick={onBack} variant="minimal" />
        <Icon icon={project.icon as IconName} className="text-gray-500" />
        <H5 title={project.name} className="mb-0! truncate grow">
          {project.name}
        </H5>
      </div>
      <Tabs
        id="ProjectSidebarTabs"
        selectedTabId={activeTab}
        onChange={(id) => onTabChange(id as any)}
        className="ml-2"
      >
        <Tab id="home" icon="home" />
        <Tab
          id="articles"
          title="Articles"
          icon="document"
          tagContent={articlesCount}
        />
        <Tab id="settings" title="Settings" icon="cog" />
      </Tabs>
    </div>
  );
}
