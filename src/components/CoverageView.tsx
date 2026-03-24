import { useState } from "react";
import { MapView } from "./MapView";
import { TimelineView } from "./TimelineView";
import type { Project } from "../types";
import {
  NonIdealState,
  Section,
  SectionCard,
  Spinner,
} from "@blueprintjs/core";
import { useArticlesWithLocations } from "../hooks/queries";
import { ensureError } from "../utils/errorUtils";

type CoverageViewProps = {
  project: Project;
};

export type SelectionSource = "map" | "timeline";

export type SelectionState = {
  id: string;
  timestamp: number;
  source: SelectionSource;
};

export function CoverageView({ project }: CoverageViewProps) {
  const { data: articles = [], isLoading, error } = useArticlesWithLocations(project.id);
  const [selection, setSelection] = useState<SelectionState | null>(null);

  const handleArticleSelect = (id: string, source: SelectionSource = "timeline") => {
    setSelection({ id, timestamp: Date.now(), source });
  };

  if (isLoading) {
    return (
      <div className="p-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12">
        <NonIdealState
          icon="error"
          title="Error Loading Coverage"
          description={ensureError(error).message}
        />
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="p-12">
        <NonIdealState
          icon="map"
          title="No Location Data"
          description="No articles with geocoded locations were found in this project."
        />
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col overflow-hidden">
      <div className="grow grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
        <Section
          title="Event Timeline"
          icon="timeline-events"
          className="h-full flex flex-col overflow-hidden"
        >
          <SectionCard padded={false} className="grow overflow-y-auto">
            <TimelineView 
              articles={articles} 
              activeArticleId={selection?.id || null}
              onArticleClick={(id) => handleArticleSelect(id, "timeline")}
            />
          </SectionCard>
        </Section>

        <Section
          title="Geographic Distribution"
          icon="map"
          className="h-full flex flex-col overflow-hidden"
        >
          <SectionCard padded={false} className="grow overflow-hidden">
            <MapView 
              articles={articles} 
              selection={selection}
              onArticleClick={(id) => handleArticleSelect(id, "map")}
            />
          </SectionCard>
        </Section>
      </div>
    </div>
  );
}
