import {
  Button,
  Callout,
  Card,
  Dialog,
  Elevation,
  FormGroup,
  H5,
  Icon,
  InputGroup,
  Intent,
  NumericInput,
  ProgressBar,
  Tag,
  TextArea,
  Switch,
  Divider,
} from "@blueprintjs/core";
import { useCallback, useEffect, useState } from "react";
import { projectsApi } from "../../api";
import { useToaster } from "../../hooks/useToaster";
import type { ModelAdapter, Project, TrainingRequest } from "../../types";

type ModelLibraryProps = {
  project: Project;
  onProjectUpdate: (project: Project) => void;
};

export function ModelLibrary({ project, onProjectUpdate }: ModelLibraryProps) {
  const [adapters, setAdapters] = useState<ModelAdapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTrainDialogOpen, setIsTrainDialogOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [trainingParams, setTrainingParams] = useState<TrainingRequest>({
    name: "Disaster Model v1",
    description: "Fine-tuned on reviewed disaster reports.",
    epochs: 10,
    batch_size: 4,
    lora_rank: 8,
    lora_alpha: 16,
    encoder_lr: 1e-5,
    task_lr: 5e-4,
    warmup_ratio: 0.1,
    weight_decay: 0.01,
    use_early_stopping: false,
  });
  const [isTraining, setIsTraining] = useState(false);
  const { toaster } = useToaster();

  const fetchAdapters = useCallback(async () => {
    try {
      const data = await projectsApi.listAdapters(project.id);
      setAdapters(data);
    } catch {
      toaster?.show({
        message: "Failed to load adapters",
        intent: Intent.DANGER,
      });
    } finally {
      setLoading(false);
    }
  }, [project.id, toaster]);

  const hasTrainingAdapter = adapters.some((a) => a.status === "training");

  useEffect(() => {
    fetchAdapters();
    const interval = setInterval(() => {
      if (hasTrainingAdapter) {
        fetchAdapters();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchAdapters, hasTrainingAdapter]);

  const handleTrain = async () => {
    setIsTraining(true);
    try {
      await projectsApi.trainAdapter(project.id, trainingParams);
      toaster?.show({
        message: "Training started in background",
        intent: Intent.SUCCESS,
      });
      setIsTrainDialogOpen(false);
      fetchAdapters();
    } catch (err) {
      toaster?.show({
        message: err instanceof Error ? err.message : "Training failed",
        intent: Intent.DANGER,
      });
    } finally {
      setIsTraining(false);
    }
  };

  const handleActivate = async (adapterId: string) => {
    try {
      await projectsApi.activateAdapter(project.id, adapterId);
      toaster?.show({ message: "Adapter activated", intent: Intent.SUCCESS });
      const updatedProject = await projectsApi.get(project.id);
      onProjectUpdate(updatedProject);
    } catch {
      toaster?.show({
        message: "Failed to activate adapter",
        intent: Intent.DANGER,
      });
    }
  };

  const handleDeactivate = async () => {
    try {
      await projectsApi.deactivateAdapter(project.id);
      toaster?.show({ message: "Adapter deactivated", intent: Intent.SUCCESS });
      const updatedProject = await projectsApi.get(project.id);
      onProjectUpdate(updatedProject);
    } catch {
      toaster?.show({
        message: "Failed to deactivate adapter",
        intent: Intent.DANGER,
      });
    }
  };

  const activeAdapterId = project.extraction_config.active_adapter_id as
    | string
    | undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Base Model Card */}
        <Card
          elevation={!activeAdapterId ? Elevation.TWO : Elevation.ZERO}
          className={`flex flex-col border-2 relative ${
            !activeAdapterId
              ? "border-blue-500 bg-blue-50/30 dark:bg-blue-900/20 shadow-md"
              : "border-gray-200 dark:border-bp-dark-border"
          }`}
        >
          {!activeAdapterId && (
            <div className="absolute top-2 right-2">
              <Tag intent={Intent.SUCCESS} round icon="tick">
                ACTIVE
              </Tag>
            </div>
          )}
          <div className="flex items-start gap-3 mb-3">
            <div
              className={`p-2 rounded ${!activeAdapterId ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-bp-dark-header text-gray-400"}`}
            >
              <Icon icon="cube" size={20} />
            </div>
            <div>
              <H5 className="mb-0">Base Engine</H5>
              <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                {project.extraction_config.model_id?.split("/").pop()}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 flex-1">
            Standard generalized model for disaster monitoring. Best for broad
            extraction and multi-hazard events.
          </p>
          <div className="mt-4 flex justify-end">
            <Button
              text={!activeAdapterId ? "Currently Active" : "Reset to Base"}
              disabled={!activeAdapterId}
              intent={Intent.NONE}
              onClick={handleDeactivate}
              minimal={!activeAdapterId}
              icon={!activeAdapterId ? "tick" : "history"}
            />
          </div>
        </Card>

        {/* Adapter Cards */}
        {adapters.map((adapter) => (
          <Card
            key={adapter.id}
            elevation={
              activeAdapterId === adapter.id ? Elevation.TWO : Elevation.ZERO
            }
            className={`flex flex-col border-2 relative ${
              activeAdapterId === adapter.id
                ? "border-green-500 dark:border-green-600 bg-green-50/30 dark:bg-green-900/20 shadow-md"
                : "border-gray-200 dark:border-bp-dark-border"
            }`}
          >
            {activeAdapterId === adapter.id && (
              <div className="absolute top-2 right-2">
                <Tag intent={Intent.SUCCESS} round icon="tick">
                  ACTIVE
                </Tag>
              </div>
            )}
            <div className="flex items-start gap-3 mb-3">
              <div
                className={`p-2 rounded ${activeAdapterId === adapter.id ? "bg-green-500 text-white" : "bg-gray-100 dark:bg-bp-dark-header text-gray-400"}`}
              >
                <Icon icon="box" size={20} />
              </div>
              <div className="min-w-0 pr-16">
                <H5 className="mb-0 truncate" title={adapter.name}>
                  {adapter.name}
                </H5>
                <div className="flex items-center gap-2">
                  <Tag minimal round className="text-[8px] h-3 px-1">
                    {adapter.status.toUpperCase()}
                  </Tag>
                  <span className="text-[10px] text-gray-400 font-mono">
                    n={adapter.num_samples}
                  </span>
                  {adapter.f1_score !== undefined &&
                    adapter.f1_score !== null && (
                      <Tag
                        minimal
                        round
                        intent={Intent.WARNING}
                        className="text-[8px] h-3 px-1"
                      >
                        F1: {(adapter.f1_score * 100).toFixed(1)}%
                      </Tag>
                    )}
                </div>
              </div>
            </div>

            <div className="flex-1">
              {adapter.status === "training" ? (
                <div className="py-4">
                  <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-tight">
                    Fine-tuning in progress...
                  </p>
                  <ProgressBar intent={Intent.PRIMARY} className="h-2" />
                </div>
              ) : (
                <p
                  className="text-xs text-gray-600 line-clamp-2"
                  title={adapter.description}
                >
                  {adapter.description || "No description provided."}
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-between items-center">
              <span className="text-[10px] text-gray-400">
                {new Date(adapter.created_at).toLocaleDateString()}
              </span>
              <div className="flex gap-2">
                {activeAdapterId === adapter.id ? (
                  <Button
                    text="Active"
                    minimal
                    icon="tick"
                    disabled
                    intent={Intent.SUCCESS}
                  />
                ) : (
                  <Button
                    text="Use Model"
                    intent={
                      adapter.status === "completed"
                        ? Intent.SUCCESS
                        : Intent.NONE
                    }
                    disabled={adapter.status !== "completed"}
                    onClick={() => handleActivate(adapter.id)}
                    icon="play"
                  />
                )}
              </div>
            </div>
          </Card>
        ))}

        {/* Add New Card */}
        <Card
          elevation={Elevation.ZERO}
          className="flex flex-col border-2 border-dashed border-gray-300 dark:border-[#5e6064] bg-gray-50/50 dark:bg-bp-dark-surface/50 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-blue-400 transition-colors cursor-pointer items-center justify-center p-8 group"
          onClick={() => setIsTrainDialogOpen(true)}
        >
          <div className="p-4 rounded-full bg-white dark:bg-bp-dark-bg border border-gray-200 dark:border-bp-dark-border group-hover:border-blue-200 group-hover:text-blue-500 text-gray-400 mb-2 transition-colors shadow-sm">
            <Icon icon="plus" size={24} />
          </div>
          <span className="text-sm font-bold text-gray-500 dark:text-gray-400 group-hover:text-blue-600">
            Train New Adapter
          </span>
          <span className="text-[10px] text-gray-400 mt-1">
            Specialized LoRA weights
          </span>
        </Card>
      </div>

      {!loading && adapters.length === 0 && (
        <Callout
          intent={Intent.PRIMARY}
          icon="info-sign"
          title="Build Your Model Library"
        >
          <p className="text-xs">
            Review articles with correct annotations to create high-quality
            training data. Once you have enough data, you can train specialized
            **LoRA adapters** (lightweight model modifications) that surgically
            improve extraction performance for your specific disaster context.
          </p>
        </Callout>
      )}

      {/* Train Dialog */}
      <Dialog
        isOpen={isTrainDialogOpen}
        onClose={() => setIsTrainDialogOpen(false)}
        title="New Model Adapter"
        icon="wrench"
        className="pb-0!"
      >
        <div className="p-4 flex flex-col gap-4">
          <Callout
            intent={Intent.WARNING}
            icon="database"
            title="Reviewed Articles Required"
          >
            <p className="text-xs">
              This will train a LoRA adapter using all **reviewed** articles.
              Ensure you've vetted the entities in the "Articles" tab for best
              results.
            </p>
          </Callout>

          <FormGroup
            label="Adapter Name"
            helperText="e.g., Cyclone Monitoring v2"
          >
            <InputGroup
              fill
              value={trainingParams.name}
              onChange={(e) =>
                setTrainingParams((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </FormGroup>

          <FormGroup label="Description">
            <TextArea
              fill
              autoResize
              value={trainingParams.description}
              onChange={(e) =>
                setTrainingParams((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </FormGroup>

          <div className="grid grid-cols-2 gap-4">
            <FormGroup label="Epochs" helperText="Training cycles.">
              <NumericInput
                fill
                min={1}
                max={50}
                value={trainingParams.epochs}
                onValueChange={(v) =>
                  setTrainingParams((prev) => ({ ...prev, epochs: v }))
                }
              />
            </FormGroup>
            <FormGroup
              label="LoRA Rank"
              helperText="Complexity (8 is standard)."
            >
              <NumericInput
                fill
                min={4}
                max={64}
                stepSize={4}
                value={trainingParams.lora_rank}
                onValueChange={(v) =>
                  setTrainingParams((prev) => ({
                    ...prev,
                    lora_rank: v,
                    lora_alpha: v * 2,
                  }))
                }
              />
            </FormGroup>
          </div>

          <Divider />

          <div className="flex justify-between items-center">
            <H5 className="mb-0 text-xs text-gray-500 dark:text-gray-400 uppercase">
              Advanced Settings
            </H5>
            <Switch
              checked={showAdvanced}
              onChange={() => setShowAdvanced(!showAdvanced)}
              large
              className="mb-0!"
            />
          </div>

          {showAdvanced && (
            <div className="space-y-4 animate-[fade-in_0.2s_ease]">
              <div className="grid grid-cols-2 gap-4">
                <FormGroup label="Encoder LR" labelInfo="(default 1e-5)">
                  <NumericInput
                    fill
                    stepSize={0.000001}
                    minorStepSize={0.0000001}
                    value={trainingParams.encoder_lr}
                    onValueChange={(v) =>
                      setTrainingParams((prev) => ({ ...prev, encoder_lr: v }))
                    }
                  />
                </FormGroup>
                <FormGroup label="Task LR" labelInfo="(default 5e-4)">
                  <NumericInput
                    fill
                    stepSize={0.0001}
                    minorStepSize={0.00001}
                    value={trainingParams.task_lr}
                    onValueChange={(v) =>
                      setTrainingParams((prev) => ({ ...prev, task_lr: v }))
                    }
                  />
                </FormGroup>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormGroup label="Warmup Ratio" labelInfo="(0-1)">
                  <NumericInput
                    fill
                    min={0}
                    max={1}
                    stepSize={0.05}
                    value={trainingParams.warmup_ratio}
                    onValueChange={(v) =>
                      setTrainingParams((prev) => ({ ...prev, warmup_ratio: v }))
                    }
                  />
                </FormGroup>
                <FormGroup label="Weight Decay" labelInfo="(default 0.01)">
                  <NumericInput
                    fill
                    min={0}
                    stepSize={0.005}
                    value={trainingParams.weight_decay}
                    onValueChange={(v) =>
                      setTrainingParams((prev) => ({ ...prev, weight_decay: v }))
                    }
                  />
                </FormGroup>
              </div>

              <Switch
                label="Enable Early Stopping"
                checked={trainingParams.use_early_stopping}
                onChange={(e) =>
                  setTrainingParams((prev) => ({
                    ...prev,
                    use_early_stopping: e.currentTarget.checked,
                  }))
                }
              />
            </div>
          )}
        </div>
        <div className="p-3 bg-gray-50 dark:bg-bp-dark-surface border-t border-gray-200 dark:border-bp-dark-border flex justify-end gap-2 rounded-b">
          <Button
            text="Cancel"
            onClick={() => setIsTrainDialogOpen(false)}
            minimal
          />
          <Button
            text="Launch Training"
            intent={Intent.PRIMARY}
            icon="rocket"
            loading={isTraining}
            onClick={handleTrain}
          />
        </div>
      </Dialog>
    </div>
  );
}
