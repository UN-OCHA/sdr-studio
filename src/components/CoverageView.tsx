import {
  Icon,
  NonIdealState,
  Section,
  SectionCard,
  Spinner,
} from "@blueprintjs/core";
import { useState } from "react";
import { useArticlesWithLocations } from "../hooks/queries";
import type { Project } from "../types";
import { ensureError } from "../utils/errorUtils";
import { MapView } from "./MapView";
import { TimelineView } from "./TimelineView";

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
  const {
    data: articles = [],
    isLoading,
    error,
  } = useArticlesWithLocations(project.id);
  const [selection, setSelection] = useState<SelectionState | null>(null);

  const handleArticleSelect = (
    id: string,
    source: SelectionSource = "timeline",
  ) => {
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

  const entities = project.extraction_config?.entities || {};
  const hasLocationLabel = Object.values(entities).some(
    (e) => typeof e !== "string" && e.is_location,
  );
  const hasDateLabel = Object.values(entities).some(
    (e) => typeof e !== "string" && e.is_date,
  );

  if (articles.length === 0) {
    return (
      <div className="p-12">
        <NonIdealState
          icon="map-marker"
          title="No Coverage Data"
          description={
            <div className="max-w-md mx-auto text-center">
              <p className="mb-4">
                No articles with geocoded locations or event dates were found.
              </p>
              {!hasLocationLabel || !hasDateLabel ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 text-left">
                  <h5 className="text-blue-800 dark:text-blue-300 font-bold text-xs uppercase mb-2 flex items-center gap-2">
                    <Icon icon="info-sign" size={12} /> Configuration Required
                  </h5>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
                    To enable geographic and temporal analysis, you must
                    configure your <strong>Project Settings</strong> to include:
                  </p>
                  <ul className="list-disc ml-4 mt-2 text-[11px] text-blue-700 dark:text-blue-400 space-y-1">
                    {!hasLocationLabel && (
                      <li>
                        An entity label marked as <strong>"Is Location"</strong> (for the map)
                      </li>
                    )}
                    {!hasDateLabel && (
                      <li>
                        An entity label marked as <strong>"Is Date/Time"</strong> (for the timeline)
                      </li>
                    )}
                  </ul>
                  <p className="mt-2 text-[11px] text-blue-600 dark:text-blue-500 italic">
                    Note: Articles must be (re)processed after changing these
                    settings.
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Your project is correctly configured, but no relevant entities
                  have been extracted yet. Try adding more sources or adjusting
                  extraction thresholds.
                </p>
              )}
            </div>
          }
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
