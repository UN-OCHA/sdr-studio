import {
  Button,
  EntityTitle,
  H5,
  Icon,
  Tab,
  Tabs,
  type IconName,
} from "@blueprintjs/core";
import type { Project } from "../../types";

type ProjectHomeHeaderProps = {
  project: Project;
  activeTab: "home" | "articles" | "settings" | "coverage";
  onTabChange: (tab: "home" | "articles" | "settings" | "coverage") => void;
  articlesCount: number;
  onBack: () => void;
};

export function ProjectHomeHeader({
  project,
  activeTab,
  onTabChange,
  articlesCount,
  onBack,
}: ProjectHomeHeaderProps) {
  return (
    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between shadow-sm z-10 shrink-0">
      <div className="flex items-center gap-1">
        <Button icon="arrow-left" onClick={onBack} variant="minimal" small />
        <Icon
          icon={project.icon as IconName}
          size={18}
          className="text-gray-500 ml-1"
        />
        <EntityTitle
          title={project.name}
          subtitle={project.description}
          heading={H5}
          className="ml-1"
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
        <Tab id="coverage" title="Coverage" icon="map" />
        <Tab id="settings" title="Settings" icon="cog" />
      </Tabs>
    </div>
  );
}
