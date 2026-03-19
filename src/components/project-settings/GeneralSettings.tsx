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
  {
    label: "GLiNER Multi (v1)",
    value: "fastino/gliner2-multi-v1",
    description: "Multilingual model optimized for speed and efficiency.",
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
    if (!modifiers.matchesPredicate) return null;
    return (
      <MenuItem
        active={modifiers.active}
        disabled={modifiers.disabled}
        key={model.value}
        labelElement={
          <span className="text-[10px] text-gray-500">{model.value}</span>
        }
        onClick={handleClick}
        onFocus={handleFocus}
        text={
          <div>
            <div className="font-bold text-xs">{model.label}</div>
            <div className="text-[10px] text-gray-500 leading-tight mt-0.5">
              {model.description}
            </div>
          </div>
        }
        multiline
      />
    );
  };

  return (
    <div className="space-y-6">
      <Section
        title="Intelligence Engine"
        subtitle="The brain of your project. Determines extraction quality and speed."
        icon="predictive-analysis"
      >
        <SectionCard>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormGroup
              label="Extraction Model (GLiNER)"
              labelInfo="(Requires Reprocessing)"
              helperText="Determines how entities, relations, and objects are recognized."
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
                  variant="outlined"
                />
              </Select>
            </FormGroup>

            <FormGroup
              label="Summarization Model"
              labelInfo="(Requires Reprocessing)"
              helperText="Used to generate a concise summary of article content."
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
                  variant="outlined"
                />
              </Select>
            </FormGroup>
          </div>
        </SectionCard>
      </Section>

      <Section
        title="Content Cleaning"
        subtitle="Automated noise reduction for scraped web content."
        icon="clean"
      >
        <SectionCard>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-gray-800">
                  Model-based Noise Reduction
                </div>
                <div className="text-xs text-gray-500">
                  Identify and strip navigation, social bits, and banners.
                </div>
              </div>
              <Switch
                large
                checked={cleaning.use_local_model}
                onChange={(e) =>
                  updateCleaning({ use_local_model: e.currentTarget.checked })
                }
                innerLabelChecked="On"
                innerLabel="Off"
              />
            </div>

            {cleaning.use_local_model && (
              <Callout
                intent="primary"
                icon="info-sign"
                className="bg-blue-50/50 border-blue-100"
              >
                <div className="text-[11px] leading-relaxed">
                  This uses a local T5-based model to detect and prune{" "}
                  <strong>Navigation</strong>, <strong>Social Media</strong>,
                  and <strong>Cookies</strong> banners. It only affects the
                  start of the article where most noise resides.
                </div>
              </Callout>
            )}
          </div>
        </SectionCard>
      </Section>

      <Section
        title="Extraction Sensitivity"
        subtitle="Fine-tune how strict the model is when identifying data points."
        icon="filter"
      >
        <SectionCard>
          <FormGroup
            label="Global Confidence Threshold"
            labelInfo="(0.0 - 1.0)"
            helperText="Default threshold if not overridden by specific entities. Higher = strict."
          >
            <NumericInput
              fill
              min={0}
              max={1}
              stepSize={0.05}
              majorStepSize={0.1}
              minorStepSize={0.01}
              value={config.threshold || 0.3}
              onValueChange={(v) => onUpdateConfig({ threshold: v })}
              leftIcon="trending-up"
            />
          </FormGroup>
        </SectionCard>
      </Section>
    </div>
  );
}
