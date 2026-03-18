export type Project = {
  id: string;
  name: string;
  description: string;
  icon: string;
  extraction_config: {
    model_id?: string;
    summary_model_id?: string;
    entities?: Record<string, string>;
    classifications?: Record<string, string[]>;
    structures?: Array<{
      name: string;
      fields: Array<{
        name: string;
        dtype: "str" | "int" | "float" | "bool" | "list";
        choices?: string[];
        description?: string;
      }>;
    }>;
    threshold?: number;
    [key: string]: unknown;
  };
  onboarding_completed: boolean;
  created_at: string;
};

export type ProjectCreate = {
  name: string;
  description: string;
  icon?: string;
  extraction_config?: Project["extraction_config"];
};

export type ProjectUpdate = {
  name?: string;
  description?: string;
  icon?: string;
  extraction_config?: Project["extraction_config"];
  onboarding_completed?: boolean;
};

export type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  extraction_config: Project["extraction_config"];
  org_id: string;
  created_at: string;
};

export type ProjectTemplateCreate = {
  name: string;
  description: string;
  icon?: string;
  extraction_config?: Project["extraction_config"];
};

export type ProjectTemplateUpdate = {
  name?: string;
  description?: string;
  icon?: string;
  extraction_config?: Project["extraction_config"];
};

export type Article = {
  id: string;
  project_id: string;
  url: string;
  title: string;
  content: string;
  summary: string;
  status: "pending" | "processing" | "completed" | "error";
  reviewed: boolean;
  error_message?: string;
  structured_data: Record<string, unknown>;
  processing_step: string;
  created_at: string;
  annotations: Annotation[];
};

export type ArticleUpdate = {
  title?: string;
  summary?: string;
  reviewed?: boolean;
  structured_data?: Record<string, unknown>;
};

export type Annotation = {
  id: string;
  article_id: string;
  start: number;
  end: number;
  label: string;
};

export type ModelAdapter = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  base_model: string;
  adapter_path: string;
  status: "training" | "completed" | "error";
  num_samples: number;
  f1_score?: number;
  created_at: string;
};

export type TrainingRequest = {
  name: string;
  description?: string;
  epochs: number;
  batch_size: number;
  lora_rank: number;
  lora_alpha: number;
};
