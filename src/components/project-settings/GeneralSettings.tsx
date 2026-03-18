import {
  Button,
  Callout,
  FormGroup,
  MenuItem,
  NumericInput,
  Section,
  SectionCard,
  Switch,
} from "@blueprintjs/core";
import { Select, type ItemRenderer } from "@blueprintjs/select";
import type { Project } from "../../types";

type ModelOption = {
  label: string;
  value: string;
  description: string;
};

const EXTRACTION_MODELS: ModelOption[] = [
  {
    label: "GLiNER2 Base (v1)",
    value: "fastino/gliner2-base-v1",
    description:
      "Optimized for speed and efficiency with high entity recognition quality.",
  },
  {
    label: "GLiNER2 Large (v1)",
    value: "fastino/gliner2-large-v1",
    description:
      "Maximum accuracy for complex extraction tasks. Slower than base.",
  },
];

const SUMMARY_MODELS: ModelOption[] = [
  {
    label: "DistilBART CNN (Fast)",
    value: "sshleifer/distilbart-cnn-12-6",
    description:
      "Standard fast summarization model. Good for most news articles.",
  },
  {
    label: "BART Large CNN (Accurate)",
    value: "facebook/bart-large-cnn",
    description:
      "Larger and slower model. Produces higher quality, more coherent summaries.",
  },
  {
    label: "T5 Small (Very Fast)",
    value: "t5-small",
    description: "Extremely lightweight, but summaries might be less coherent.",
  },
];

type GeneralSettingsProps = {
  config: Project["extraction_config"];
  onUpdateConfig: (updates: Partial<Project["extraction_config"]>) => void;
};

export function GeneralSettings({
  config,
  onUpdateConfig,
}: GeneralSettingsProps) {
  const currentModel =
    EXTRACTION_MODELS.find(
      (m) => m.value === (config.model_id || "fastino/gliner2-base-v1"),
    ) || EXTRACTION_MODELS[0];

  const currentSummaryModel =
    SUMMARY_MODELS.find(
      (m) =>
        m.value ===
        (config.summary_model_id || "sshleifer/distilbart-cnn-12-6"),
    ) || SUMMARY_MODELS[0];

  const cleaning = (config.cleaning as { use_local_model?: boolean }) || {
    use_local_model: false,
  };

  const updateCleaning = (updates: Partial<typeof cleaning>) => {
    onUpdateConfig({
      cleaning: { ...cleaning, ...updates },
    });
  };

  const renderModel: ItemRenderer<ModelOption> = (
    model,
    { handleClick, handleFocus, modifiers },
  ) => {
    if (!modifiers.matchesPredicate) {
      return null;
    }
    return (
      <MenuItem
        active={modifiers.active}
        disabled={modifiers.disabled}
        key={model.value}
        label={model.description}
        onClick={handleClick}
        onFocus={handleFocus}
        text={model.label}
        multiline
      />
    );
  };

  return (
    <div className="space-y-6">
      <Section title="Intelligence Engine" icon="predictive-analysis">
        <SectionCard>
          <FormGroup
            label="Extraction Model (GLiNER)"
            labelInfo="(Requires Reprocessing)"
            helperText="The intelligence engine determines extraction quality and speed."
          >
            <Select<ModelOption>
              items={EXTRACTION_MODELS}
              itemRenderer={renderModel}
              onItemSelect={(m) => onUpdateConfig({ model_id: m.value })}
              filterable={false}
              popoverProps={{ minimal: true, matchTargetWidth: true }}
            >
              <Button
                text={currentModel.label}
                rightIcon="double-caret-vertical"
                fill
                alignText="left"
              />
            </Select>
          </FormGroup>

          <FormGroup
            label="Summarization Model"
            labelInfo="(Requires Reprocessing)"
            helperText="Used to generate the summary of the article."
          >
            <Select<ModelOption>
              items={SUMMARY_MODELS}
              itemRenderer={renderModel}
              onItemSelect={(m) =>
                onUpdateConfig({ summary_model_id: m.value })
              }
              filterable={false}
              popoverProps={{ minimal: true, matchTargetWidth: true }}
            >
              <Button
                text={currentSummaryModel.label}
                rightIcon="double-caret-vertical"
                fill
                alignText="left"
              />
            </Select>
          </FormGroup>
        </SectionCard>
      </Section>

      <Section title="Content Cleaning" icon="clean">
        <SectionCard>
          <div className="space-y-4">
            <FormGroup helperText="Identify and strip navigation, social media bits, and other noise from the top of articles.">
              <Switch
                label="Model-based Noise Reduction"
                large
                checked={cleaning.use_local_model}
                onChange={(e) =>
                  updateCleaning({ use_local_model: e.currentTarget.checked })
                }
                innerLabelChecked="On"
                innerLabel="Off"
              />
            </FormGroup>

            {cleaning.use_local_model && (
              <Callout intent="primary" icon="info-sign">
                <div className="text-xs">
                  This uses a local model to detect <strong>Navigation</strong>,{" "}
                  <strong>Social Media</strong>, and <strong>Cookies</strong>{" "}
                  banners. It will only trim content if detected near the top
                  (first 500 chars).
                </div>
              </Callout>
            )}
          </div>
        </SectionCard>
      </Section>

      <Section title="Extraction Sensitivity" icon="filter">
        <SectionCard>
          <FormGroup
            label="Confidence Threshold"
            labelInfo="(0.0 - 1.0)"
            helperText="Lower values extract more entities but may include more false positives. Default is 0.3."
          >
            <NumericInput
              fill
              min={0}
              max={1}
              stepSize={0.05}
              majorStepSize={0.1}
              value={config.threshold || 0.3}
              onValueChange={(v) => onUpdateConfig({ threshold: v })}
            />
          </FormGroup>
        </SectionCard>
      </Section>
    </div>
  );
}
