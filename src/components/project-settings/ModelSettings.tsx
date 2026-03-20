import { FormGroup, H5, NumericInput, Section, SectionCard } from "@blueprintjs/core";

type ModelSettingsProps = {
  threshold: number;
  onChange: (threshold: number) => void;
};

export function ModelSettings({ threshold, onChange }: ModelSettingsProps) {
  return (
    <Section title="Model Configuration" icon="predictive-analysis">
      <SectionCard>
        <H5>GLiNER2 Engine</H5>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Fine-tune the extraction sensitivity.</p>
        <FormGroup
          label="Confidence Threshold"
          labelInfo="(0.0 - 1.0)"
          helperText="Lower values extract more entities but may include more false positives."
        >
          <NumericInput
            fill
            min={0}
            max={1}
            stepSize={0.05}
            majorStepSize={0.1}
            value={threshold}
            onValueChange={(v) => onChange(v)}
          />
        </FormGroup>
      </SectionCard>
    </Section>
  );
}
