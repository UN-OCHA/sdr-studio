import {
  EntityTitle,
  H4,
  Icon,
  Tab,
  Tabs,
  type IconName,
} from "@blueprintjs/core";
import type { Project } from "../../types";

type ProjectHomeHeaderProps = {
  project: Project;
  activeTab: "home" | "articles" | "settings";
  onTabChange: (tab: "home" | "articles" | "settings") => void;
  articlesCount: number;
};

export function ProjectHomeHeader({
  project,
  activeTab,
  onTabChange,
  articlesCount,
}: ProjectHomeHeaderProps) {
  return (
    <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon
          icon={project.icon as IconName}
          size={20}
          className="text-gray-500"
        />
        <EntityTitle
          title={project.name}
          subtitle={project.description}
          heading={H4}
        />
      </div>
      <Tabs
        id="ProjectNavTabs"
        selectedTabId={activeTab}
        onChange={(id) => onTabChange(id as any)}
        className="mb-0"
      >
        <Tab id="home" title="Home" icon="home" />
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
