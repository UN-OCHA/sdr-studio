import { useEffect, useState } from "react";
import { MapView } from "./MapView";
import { TimelineView } from "./TimelineView";
import { projectsApi } from "../api";
import type { Article, Project } from "../types";
import {
  NonIdealState,
  Section,
  SectionCard,
  Spinner,
} from "@blueprintjs/core";

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
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selection, setSelection] = useState<SelectionState | null>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await projectsApi.listArticlesWithLocations(project.id);
        setArticles(data);
      } catch (err: any) {
        setError(err.message || "Failed to fetch location data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLocations();
  }, [project.id]);

  const handleArticleSelect = (id: string, source: SelectionSource = "timeline") => {
    setSelection({ id, timestamp: Date.now(), source });
  };

  if (loading) {
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
          description={error}
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
