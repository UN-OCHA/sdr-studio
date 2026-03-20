import {
  Button,
  Icon,
  Intent,
  Section,
  SectionCard,
  Spinner,
} from "@blueprintjs/core";
import { useEffect, useState } from "react";
import { sourcesApi } from "../api";
import type { Project, Source } from "../types";
import { IntelligencePipeline } from "./IntelligencePipeline";

type ProjectHomeProps = {
  project: Project;
  onTabChange: (tab: any) => void;
};

export function ProjectHome({ project, onTabChange }: ProjectHomeProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sourcesData] = await Promise.all([
          sourcesApi.list(project.id),
        ]);
        setSources(sourcesData);
      } catch (error) {
        console.error("Failed to fetch project home data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [project.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Spinner />
        <p className="mt-4 text-gray-500 dark:text-gray-400 font-medium italic">
          Loading project overview...
        </p>
      </div>
    );
  }

  const config = project.extraction_config;

  const onboardingSteps = [
    {
      title: "Define Objectives",
      description: "Complete your project profile and intent.",
      completed: !!project.name && !!project.description,
      action: () => onTabChange("profile"),
      icon: "info-sign",
    },
    {
      title: "Add Sources",
      description: "Connect RSS feeds or news APIs for discovery.",
      completed: sources.length > 0,
      action: () => onTabChange("monitoring"),
      icon: "feed",
    },
    {
      title: "Configure Schema",
      description: "Define entities and classifications for extraction.",
      completed:
        Object.keys(config.entities || {}).length > 0 ||
        Object.keys(config.classifications || {}).length > 0,
      action: () => onTabChange("schema"),
      icon: "layers",
    },
    {
      title: "Model Selection",
      description: "Choose a base model or train a custom adapter.",
      completed: !!config.model_id,
      action: () => onTabChange("general"),
      icon: "cube",
    },
  ];

  const completedCount = onboardingSteps.filter((s) => s.completed).length;

  return (
    <div className="p-4 animate-[fade-in_0.4s_ease-out] space-y-4">
      {/* 1. Data Flow Visualization */}
      <Section
        title="Intelligence Pipeline"
        icon="fork"
        subtitle="End-to-end data flow visualization"
      >
        <SectionCard>
          <IntelligencePipeline project={project} sources={sources} />
        </SectionCard>
      </Section>

      {/* 2. Onboarding Checklist */}
      <Section
        title="Project Readiness"
        icon="endorsed"
        subtitle="Essential configuration steps for optimal performance"
      >
        <SectionCard padded={false}>
          <div className="p-4 bg-gray-50 dark:bg-bp-dark-surface border-b border-gray-100 dark:border-bp-dark-border flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                Setup Progress
              </div>
              <div className="text-xl font-black text-gray-900 dark:text-white">
                {completedCount} of {onboardingSteps.length} Steps Complete
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {onboardingSteps.map((step, idx) => (
              <div
                key={idx}
                className="p-4 flex items-center gap-4 group hover:bg-white dark:hover:bg-bp-dark-bg transition-colors"

              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    step.completed
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50 text-green-600 dark:text-green-400"
                      : "bg-white dark:bg-bp-dark-bg border-gray-100 dark:border-bp-dark-border text-gray-300"
                  }`}
                >
                  <Icon
                    icon={step.completed ? "tick" : (step.icon as any)}
                    size={14}
                  />
                </div>
                <div className="flex-1">
                  <div
                    className={`text-sm font-black tracking-tight ${step.completed ? "text-gray-400 line-through decoration-gray-300" : "text-gray-900 dark:text-white"}`}
                  >
                    {step.title}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {step.description}
                  </div>
                </div>
                {!step.completed && (
                  <Button
                    small
                    minimal
                    intent={Intent.PRIMARY}
                    text="Configure"
                    onClick={step.action}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </Section>
    </div>
  );
}
