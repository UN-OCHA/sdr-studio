export type ExportField = {
  key: string;
  label: string;
  source: "article" | "structured_data" | "annotations";
};

export type ReportSection = {
  id: string;
  title: string;
  type: "metadata" | "summary" | "entities" | "structured_data" | "article_list" | "custom_text";
  enabled: boolean;
  config?: {
    text?: string; // For custom_text
    fields?: string[]; // For metadata/structured_data filtering
    entity_labels?: string[]; // For entities filtering
    show_labels?: boolean;
    compact?: boolean;
  };
};

export type ReportGrouping = {
  enabled: boolean;
  field: string; // e.g., "classification.Crisis Type"
  show_empty?: boolean;
};

export type ReportConfig = {
  include_toc: boolean;
  include_description?: boolean;
  header_text?: string;
  footer_text?: string;
  grouping?: ReportGrouping;
  sections: ReportSection[];
};

export type ExportConfig = {
  fields: ExportField[];
  report?: ReportConfig;
};

export type ApiKey = {
  id: string;
  name: string;
  key: string;
  project_id: string;
  created_at: string;
  last_used?: string;
};

export type ApiKeyCreate = {
  name: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  icon: string;
  extraction_config: {
    model_id?: string;
    summary_model_id?: string;
    entities?: Record<
      string,
      | string
      | { description: string; threshold?: number; dtype?: "str" | "list" }
    >;
    classifications?: Record<
      string,
      {
        labels: string[] | Record<string, string>;
        multi_label?: boolean;
        threshold?: number;
      }
    >;
    structures?: Array<{
      name: string;
      fields: Array<{
        name: string;
        dtype: "str" | "int" | "float" | "bool" | "list";
        choices?: string[];
        description?: string;
        threshold?: number;
        validator_pattern?: string;
      }>;
    }>;
    relations?: Record<string, string>;
    threshold?: number;
    cleaning?: {
      use_local_model?: boolean;
      model_id?: string;
    };
    active_adapter_id?: string;
    active_adapter_path?: string;
  };
  export_config: ExportConfig;
  onboarding_completed: boolean;
  created_at: string;
};

export type ProjectCreate = {
  name: string;
  description: string;
  icon?: string;
  extraction_config?: Project["extraction_config"];
  export_config?: ExportConfig;
};

export type ProjectUpdate = {
  name?: string;
  description?: string;
  icon?: string;
  extraction_config?: Project["extraction_config"];
  export_config?: ExportConfig;
  onboarding_completed?: boolean;
};

export type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  extraction_config: Project["extraction_config"];
  export_config: ExportConfig;
  org_id: string;
  created_at: string;
};

export type ProjectTemplateCreate = {
  name: string;
  description: string;
  icon?: string;
  extraction_config?: Project["extraction_config"];
  export_config?: ExportConfig;
};

export type ProjectTemplateUpdate = {
  name?: string;
  description?: string;
  icon?: string;
  extraction_config?: Project["extraction_config"];
  export_config?: ExportConfig;
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
  confidence?: number;
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
  encoder_lr: number;
  task_lr: number;
  warmup_ratio: number;
  weight_decay: number;
  use_early_stopping: boolean;
};

export type Source = {
  id: string;
  project_id: string;
  name: string;
  url: string;
  type: string;
  active: boolean;
  config?: any;
  polling_interval: number;
  last_polled?: string;
  created_at: string;
};

export type SourceCreate = {
  name: string;
  url: string;
  type: string;
  polling_interval: number;
  config?: any;
};

export type SourceUpdate = {
  name?: string;
  url?: string;
  active?: boolean;
  polling_interval?: number;
  config?: any;
};
