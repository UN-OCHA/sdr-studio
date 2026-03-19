import {
  Button,
  Card,
  Divider,
  EntityTitle,
  H2,
  H5,
  Icon,
  Intent,
  ProgressBar,
  SectionCard,
  TextArea,
} from "@blueprintjs/core";
import { useState } from "react";
import { projectsApi } from "../api";
import type { Project } from "../types";
import { ExtractionSettings } from "./project-settings/ExtractionSettings";
import { GeneralSettings } from "./project-settings/GeneralSettings";

type ProjectOnboardingProps = {
  project: Project;
  onComplete: (project: Project) => void;
  onImport: (urls: string[]) => Promise<void>;
};

export function ProjectOnboarding({
  project,
  onComplete,
  onImport,
}: ProjectOnboardingProps) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState(project.extraction_config);
  const [urls, setUrls] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleFinish = async () => {
    try {
      setIsSaving(true);
      // Save final config and mark onboarding as complete
      const updated = await projectsApi.update(project.id, {
        extraction_config: config,
        onboarding_completed: true,
      });

      // Import URLs if provided
      const urlList = urls
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u !== "");
      if (urlList.length > 0) {
        await onImport(urlList);
      }

      onComplete(updated);
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <H2 className="mb-2">Setup your Project</H2>
        <p className="text-gray-500">
          Configure the extraction engine to start analyzing sources.
        </p>
        <div className="mt-8 max-w-xs mx-auto">
          <ProgressBar
            value={step / 3}
            intent={Intent.PRIMARY}
            stripes={false}
          />
          <div className="flex justify-between mt-2 text-[10px] font-bold uppercase text-gray-400">
            <span className={step >= 1 ? "text-blue-600" : ""}>Model</span>
            <span className={step >= 2 ? "text-blue-600" : ""}>Schema</span>
            <span className={step >= 3 ? "text-blue-600" : ""}>Import</span>
          </div>
        </div>
      </div>

      <Card elevation={2} className="p-0 overflow-hidden bg-white">
        <div className="p-8">
          {step === 1 && (
            <div className="animate-[fade-in_0.3s_ease]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Icon icon="predictive-analysis" size={20} />
                </div>
                <EntityTitle
                  title="Step 1: Intelligence Engine"
                  subtitle="Choose the base model and sensitivity."
                  heading={H5}
                />
              </div>
              <GeneralSettings
                config={config}
                onUpdateConfig={(updates) => setConfig({ ...config, ...updates })}
              />
            </div>
          )}

          {step === 2 && (
            <div className="animate-[fade-in_0.3s_ease]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <Icon icon="tag" size={20} />
                </div>
                <EntityTitle
                  title="Step 2: Extraction Schema"
                  subtitle="Define what entities and classifications to look for."
                  heading={H5}
                />
              </div>
              <ExtractionSettings
                config={config}
                isSaving={false}
                hideHeader
                onChange={(newConfig) => setConfig(newConfig)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="animate-[fade-in_0.3s_ease]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                  <Icon icon="cloud-upload" size={20} />
                </div>
                <EntityTitle
                  title="Step 3: Initial Data"
                  subtitle="Import your first batch of article URLs."
                  heading={H5}
                />
              </div>
              <SectionCard>
                <p className="text-sm text-gray-500 mb-4">
                  Paste a list of URLs pointing to news articles (one per line).
                  You can skip this and add them later.
                </p>
                <TextArea
                  fill
                  rows={10}
                  placeholder="https://africanews.com/..."
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  className="font-mono text-sm"
                />
              </SectionCard>
            </div>
          )}
        </div>

        <Divider />

        <div className="p-4 bg-gray-50 flex justify-between items-center">
          <Button
            minimal
            text="Previous"
            icon="arrow-left"
            disabled={step === 1 || isSaving}
            onClick={handleBack}
          />
          {step < 3 ? (
            <Button
              intent={Intent.PRIMARY}
              text="Continue"
              rightIcon="arrow-right"
              onClick={handleNext}
            />
          ) : (
            <Button
              intent={Intent.SUCCESS}
              text="Finish Setup"
              icon="tick"
              loading={isSaving}
              onClick={handleFinish}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
