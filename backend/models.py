from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from sqlmodel import Field, SQLModel, JSON, Relationship

# -- Core Models (Base) --

class AnnotationBase(SQLModel):
    start: int
    end: int
    label: str
    org_id: str = Field(default="public", index=True)

class ArticleBase(SQLModel):
    url: str
    title: str = ""
    content: str = ""
    summary: str = ""
    status: str = "pending"  # pending, processing, completed, error
    processing_step: Optional[str] = None # e.g. "Downloading", "Cleaning", "Summarizing", etc.
    reviewed: bool = Field(default=False)
    error_message: Optional[str] = None
    structured_data: Optional[Dict[str, Any]] = Field(default={}, sa_type=JSON)
    org_id: str = Field(default="public", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProjectBase(SQLModel):
    name: str
    description: str = ""
    icon: str = "briefcase"
    org_id: str = Field(default="public", index=True)
    extraction_config: Dict[str, Any] = Field(default={}, sa_type=JSON)
    onboarding_completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# -- Project Template Models --

class ProjectTemplateBase(SQLModel):
    name: str
    description: str = ""
    icon: str = "cube"
    org_id: str = Field(default="public", index=True)
    extraction_config: Dict[str, Any] = Field(default={}, sa_type=JSON)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProjectTemplate(ProjectTemplateBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)

class ProjectTemplateRead(ProjectTemplateBase):
    id: UUID

class ProjectTemplateCreate(SQLModel):
    name: str
    description: str = ""
    icon: Optional[str] = "cube"
    extraction_config: Dict[str, Any] = Field(default={}, sa_type=JSON)

class ProjectTemplateUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    extraction_config: Optional[Dict[str, Any]] = None

# -- Database Models --

class Annotation(AnnotationBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    article_id: UUID = Field(foreign_key="article.id")
    
    article: "Article" = Relationship(back_populates="annotations")

class Article(ArticleBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id")
    
    project: "Project" = Relationship(back_populates="articles")
    annotations: List[Annotation] = Relationship(back_populates="article", cascade_delete=True)

class Project(ProjectBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    
    articles: List[Article] = Relationship(back_populates="project", cascade_delete=True)
    sources: List["Source"] = Relationship(back_populates="project", cascade_delete=True)

# -- Monitoring Source Models --

class SourceBase(SQLModel):
    name: str
    url: str
    type: str = "rss"  # rss, twitter, scrape
    active: bool = True
    last_polled: Optional[datetime] = None
    org_id: str = Field(default="public", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Source(SourceBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id")
    
    project: Project = Relationship(back_populates="sources")

class SourceRead(SourceBase):
    id: UUID
    project_id: UUID

class SourceCreate(SQLModel):
    name: str
    url: str
    type: str = "rss"

class SourceUpdate(SQLModel):
    name: Optional[str] = None
    url: Optional[str] = None
    type: Optional[str] = None
    active: Optional[bool] = None

# -- API Models (Schemas) --

class AnnotationRead(AnnotationBase):
    id: UUID

class ArticleRead(ArticleBase):
    id: UUID
    project_id: UUID

class ArticleReadWithAnnotations(ArticleRead):
    annotations: List[AnnotationRead] = []

class ProjectRead(ProjectBase):
    id: UUID

class ProjectReadWithArticles(ProjectRead):
    articles: List[ArticleRead] = []

class ArticleListResponse(SQLModel):
    articles: List[ArticleReadWithAnnotations]
    total: int

class ProjectCreate(SQLModel):
    name: str
    description: str = ""
    icon: Optional[str] = "briefcase"
    extraction_config: Optional[Dict[str, Any]] = None

class ProjectUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    extraction_config: Optional[Dict[str, Any]] = None
    onboarding_completed: Optional[bool] = None

# -- Model Adapter (Library) Models --

class ModelAdapterBase(SQLModel):
    name: str
    description: str = ""
    base_model: str = "fastino/gliner2-base-v1"
    adapter_path: str = ""
    status: str = "training"  # training, completed, error
    num_samples: int = 0
    f1_score: Optional[float] = None
    org_id: str = Field(default="public", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ModelAdapter(ModelAdapterBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id")

class ModelAdapterRead(ModelAdapterBase):
    id: UUID
    project_id: UUID

class TrainingRequest(SQLModel):
    name: str
    description: str = ""
    epochs: int = 10
    batch_size: int = 4
    lora_rank: int = 8
    lora_alpha: float = 16.0

class ArticleImport(SQLModel):
    urls: List[str]

class ArticleUpdate(SQLModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    reviewed: Optional[bool] = None
    structured_data: Optional[Dict[str, Any]] = None

class AnnotationUpdate(SQLModel):
    annotations: List[AnnotationBase]
