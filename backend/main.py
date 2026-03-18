from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, delete
from database import get_session, create_db_and_tables
from auth import get_current_org_id
from models import (
    Project, Article, Annotation, ModelAdapter,
    ProjectCreate, ProjectUpdate, ArticleImport, ArticleUpdate, AnnotationUpdate,
    ProjectRead, ArticleRead, ArticleReadWithAnnotations, ArticleListResponse,
    ModelAdapterRead, TrainingRequest,
    Source, SourceRead, SourceCreate, SourceUpdate,
    ProjectTemplate, ProjectTemplateRead, ProjectTemplateCreate, ProjectTemplateUpdate
)
from curl_cffi import requests
from readability import Document
from gliner2 import GLiNER2, RegexValidator
from gliner2.training.trainer import GLiNER2Trainer, TrainingConfig
from gliner2.training.data import InputExample
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from sqlalchemy import func, desc, asc, or_
import os
import shutil

app = FastAPI(title="SDR Studio API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global models cache to avoid reloading on every task
summarizer_cache = {}
gliner_cache = {}
cleaning_cache = {}

def get_summarizer(model_name: str = "sshleifer/distilbart-cnn-12-6"):
    if model_name not in summarizer_cache:
        print(f"Loading summarization model ({model_name})...")
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        summarizer_cache[model_name] = (tokenizer, model)
    return summarizer_cache[model_name]

def get_gliner(model_id: str, adapter_path: Optional[str] = None):
    # Use a combined key for cache to distinguish between base model and adapters
    cache_key = f"{model_id}::{adapter_path}" if adapter_path else model_id
    
    if cache_key not in gliner_cache:
        print(f"Loading GLiNER2 model ({model_id}) with adapter ({adapter_path})...")
        model = GLiNER2.from_pretrained(model_id)
        if adapter_path and os.path.exists(adapter_path):
            model.load_adapter(adapter_path)
        gliner_cache[cache_key] = model
    return gliner_cache[cache_key]

def get_cleaning_model(model_id: str = "google/flan-t5-small"):
    if model_id not in cleaning_cache:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        print(f"Loading cleaning model ({model_id})...")
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_id)
        cleaning_cache[model_id] = (tokenizer, model)
    return cleaning_cache[model_id]

DEFAULT_CONFIG = {
    "model_id": "fastino/gliner2-base-v1",
    "summary_model_id": "sshleifer/distilbart-cnn-12-6",
    "threshold": 0.3,
    "cleaning": {
        "use_local_model": False,
        "model_id": "fastino/gliner2-base-v1"
    },
    "entities": {
        "Location": "Geographic locations mentioned",
        "Date": "Dates or time references",
        "Population impact": "Impact on people (deaths, injuries, displaced)",
        "Infrastructure impact": "Damage to buildings, roads, etc.",
        "Hazard descriptor": "Type of disaster (cyclone, flood, etc.)",
        "Event name": "Specific name of the event",
        "Organization": "Relief groups, government agencies"
    },
    "relations": {
        "impacts": "Hazard impacts a specific location",
        "occurred_in": "Event occurred in a location",
        "reported_by": "Information reported by an organization",
        "associated_with": "Two entities are related in some way"
    },
    "classifications": {
        "Severity": ["Low", "Medium", "High", "Critical"]
    }
}

def build_gliner_schema(extractor, config: Dict[str, Any]):
    schema = extractor.create_schema()
    
    entities = config.get("entities", {})
    if entities:
        schema = schema.entities(entities)
    
    relations = config.get("relations", {})
    if relations:
        schema = schema.relations(relations)
    
    classifications = config.get("classifications", {})
    for name, choices in classifications.items():
        schema = schema.classification(name, choices)
        
    structures = config.get("structures", [])
    for struct in structures:
        s = schema.structure(struct["name"])
        for field in struct.get("fields", []):
            validators = []
            if field.get("validator_pattern"):
                # Always use 'partial' mode as it is safer for extraction-only fields
                # where exact string matches can be finicky.
                validators.append(RegexValidator(field["validator_pattern"], mode="partial"))
            
            s = s.field(
                field["name"], 
                dtype=field.get("dtype", "str"),
                choices=field.get("choices"),
                description=field.get("description"),
                validators=validators
            )
    return schema

def poll_sources_task():
    """Periodically check all active sources for new articles."""
    from database import engine
    from datetime import datetime, timezone
    import feedparser
    
    with Session(engine) as session:
        # Get all active sources
        sources = session.exec(select(Source).where(Source.active == True)).all()
        
        for source in sources:
            try:
                print(f"Polling source: {source.name} ({source.url})")
                
                if source.type == "rss":
                    feed = feedparser.parse(source.url)
                    new_urls = []
                    
                    for entry in feed.entries:
                        url = entry.link
                        # Basic check if article already exists in this project
                        existing = session.exec(
                            select(Article).where(Article.project_id == source.project_id).where(Article.url == url)
                        ).first()
                        
                        if not existing:
                            new_urls.append(url)
                    
                    if new_urls:
                        print(f"Found {len(new_urls)} new articles in {source.name}")
                        # Process them in background
                        import_articles_logic(source.project_id, new_urls, source.org_id, session, None)
                
                # Update last_polled
                source.last_polled = datetime.now(timezone.utc)
                session.add(source)
                session.commit()
                
            except Exception as e:
                print(f"Error polling source {source.name}: {e}")

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    
    # Start poller in background
    from threading import Thread
    import time
    
    def poller_loop():
        # Wait a bit for server to start
        time.sleep(10)
        while True:
            try:
                poll_sources_task()
            except Exception as e:
                print(f"Poller loop error: {e}")
            # Poll every 15 minutes
            time.sleep(900)
            
    Thread(target=poller_loop, daemon=True).start()

# Templates
@app.get("/api/templates", response_model=List[ProjectTemplateRead])
def list_templates(org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    templates = session.exec(select(ProjectTemplate).where(ProjectTemplate.org_id == org_id)).all()
    
    # If no templates exist for this org, seed the defaults
    if not templates:
        defaults = [
            {
                "name": "Natural Disaster",
                "description": "Template for monitoring floods, earthquakes, and other natural events.",
                "icon": "flame",
                "extraction_config": {
                    "entities": {
                        "Location": "Geographic area affected.",
                        "DisasterType": "Type of event (Flood, Storm, etc.)",
                        "Severity": "Scale of the event.",
                        "Casualties": "Number of people affected."
                    }
                }
            },
            {
                "name": "Armed Conflict",
                "description": "Template for monitoring security incidents and conflicts.",
                "icon": "shield",
                "extraction_config": {
                    "entities": {
                        "Actor": "Groups or individuals involved.",
                        "IncidentType": "Type of event (Clash, Attack, etc.)",
                        "WeaponUsed": "Specific weaponry mentioned.",
                        "Displaced": "Number of people fleeing."
                    }
                }
            }
        ]
        for d in defaults:
            template = ProjectTemplate(**d, org_id=org_id)
            session.add(template)
        session.commit()
        templates = session.exec(select(ProjectTemplate).where(ProjectTemplate.org_id == org_id)).all()
        
    return templates

@app.post("/api/templates", response_model=ProjectTemplateRead)
def create_template(data: ProjectTemplateCreate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    template = ProjectTemplate(**data.model_dump(), org_id=org_id)
    session.add(template)
    session.commit()
    session.refresh(template)
    return template

@app.get("/api/templates/{template_id}", response_model=ProjectTemplateRead)
def get_template(template_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    template = session.exec(select(ProjectTemplate).where(ProjectTemplate.id == template_id).where(ProjectTemplate.org_id == org_id)).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@app.patch("/api/templates/{template_id}", response_model=ProjectTemplateRead)
def update_template(template_id: UUID, data: ProjectTemplateUpdate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    template = session.exec(select(ProjectTemplate).where(ProjectTemplate.id == template_id).where(ProjectTemplate.org_id == org_id)).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    values = data.model_dump(exclude_unset=True)
    for k, v in values.items():
        setattr(template, k, v)
    
    session.add(template)
    session.commit()
    session.refresh(template)
    return template

@app.delete("/api/templates/{template_id}")
def delete_template(template_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    template = session.exec(select(ProjectTemplate).where(ProjectTemplate.id == template_id).where(ProjectTemplate.org_id == org_id)).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    session.delete(template)
    session.commit()
    return {"message": "Template deleted"}

# Projects
@app.get("/api/projects", response_model=List[ProjectRead])
def list_projects(org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    projects = session.exec(select(Project).where(Project.org_id == org_id)).all()
    return projects

@app.post("/api/projects", response_model=ProjectRead)
def create_project(project_data: ProjectCreate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    config = project_data.extraction_config if project_data.extraction_config is not None else DEFAULT_CONFIG
    project = Project(
        name=project_data.name,
        description=project_data.description,
        icon=project_data.icon or "briefcase",
        org_id=org_id,
        extraction_config=config
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@app.patch("/api/projects/{project_id}", response_model=ProjectRead)
def update_project(project_id: UUID, data: ProjectUpdate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    
    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    if data.icon is not None:
        project.icon = data.icon
    if data.extraction_config is not None:
        project.extraction_config = data.extraction_config
    if data.onboarding_completed is not None:
        project.onboarding_completed = data.onboarding_completed
        
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    session.delete(project)
    session.commit()
    return {"message": "Project deleted"}

@app.get("/api/projects/{project_id}/articles", response_model=ArticleListResponse)
def list_articles(
    project_id: UUID, 
    search: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    org_id: str = Depends(get_current_org_id),
    session: Session = Depends(get_session)
):
    # Verify project belongs to org
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
        
    query = select(Article).where(Article.project_id == project_id)
    
    if search:
        query = query.where(or_(
            Article.title.ilike(f"%{search}%"),
            Article.url.ilike(f"%{search}%")
        ))
    
    if status and status != "all":
        query = query.where(Article.status == status)
    
    # Total count for pagination
    total_query = select(func.count(Article.id)).where(Article.project_id == project_id)
    if search:
        total_query = total_query.where(or_(
            Article.title.ilike(f"%{search}%"),
            Article.url.ilike(f"%{search}%")
        ))
    if status and status != "all":
        total_query = total_query.where(Article.status == status)
    
    total = session.exec(total_query).one()
    
    # Sorting
    sort_col = getattr(Article, sort_by, Article.created_at)
    if sort_order == "desc":
        query = query.order_by(desc(sort_col))
    else:
        query = query.order_by(asc(sort_col))
    
    # Pagination
    query = query.offset(skip).limit(limit)
    
    articles = session.exec(query).all()
    for article in articles:
        _ = article.annotations
    return {"articles": articles, "total": total}

@app.post("/api/projects/{project_id}/articles/bulk-delete")
def bulk_delete_articles(project_id: UUID, article_ids: List[UUID], org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    # Verify project belongs to org
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
        
    # Verify articles belong to the project
    articles = session.exec(select(Article).where(Article.id.in_(article_ids)).where(Article.project_id == project_id)).all()
    for article in articles:
        session.delete(article)
    session.commit()
    return {"message": f"Deleted {len(articles)} articles"}

def import_articles_logic(project_id: UUID, urls: List[str], org_id: str, session: Session, background_tasks: Optional[BackgroundTasks] = None):
    # Verify project belongs to org
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        return None

    for url in urls:
        article = Article(project_id=project_id, url=url, org_id=org_id)
        session.add(article)
        session.commit()
        session.refresh(article)
        
        if background_tasks:
            background_tasks.add_task(process_article_task, article.id)
        else:
            from threading import Thread
            Thread(target=process_article_task, args=(article.id,)).start()
    return len(urls)

@app.post("/api/projects/{project_id}/import")
def import_articles(project_id: UUID, data: ArticleImport, background_tasks: BackgroundTasks, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    count = import_articles_logic(project_id, data.urls, org_id, session, background_tasks)
    if count is None:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    return {"message": f"Imported {count} articles and processing started"}

@app.post("/api/projects/{project_id}/reprocess")
def reprocess_project(project_id: UUID, background_tasks: BackgroundTasks, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    # Verify project belongs to org
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
        
    articles = session.exec(select(Article).where(Article.project_id == project_id)).all()
    for article in articles:
        background_tasks.add_task(process_article_task, article.id)
    return {"message": "Reprocessing started for all articles"}

@app.get("/api/projects/{project_id}/export/json")
def export_project_json(project_id: UUID, article_ids: Optional[str] = None, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    
    query = select(Article).where(Article.project_id == project_id)
    if article_ids:
        ids = [UUID(id_str) for id_str in article_ids.split(",")]
        query = query.where(Article.id.in_(ids))
        
    articles = session.exec(query).all()
    
    export_data = []
    for article in articles:
        annotations = session.exec(select(Annotation).where(Annotation.article_id == article.id)).all()
        export_data.append({
            "url": article.url,
            "title": article.title,
            "summary": article.summary,
            "entities": [{"label": a.label, "text": article.content[a.start:a.end]} for a in annotations],
            "structured_data": article.structured_data,
            "created_at": article.created_at.isoformat()
        })
    return export_data

@app.get("/api/projects/{project_id}/export/csv")
def export_project_csv(project_id: UUID, article_ids: Optional[str] = None, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    import csv
    import io
    from fastapi.responses import StreamingResponse
    
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
        
    query = select(Article).where(Article.project_id == project_id)
    if article_ids:
        ids = [UUID(id_str) for id_str in article_ids.split(",")]
        query = query.where(Article.id.in_(ids))
        
    articles = session.exec(query).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Title", "URL", "Summary", "Entities", "Structured Data"])
    
    for article in articles:
        annotations = session.exec(select(Annotation).where(Annotation.article_id == article.id)).all()
        entities_str = "; ".join([f"{a.label}: {article.content[a.start:a.end]}" for a in annotations])
        struct_str = str(article.structured_data)
        writer.writerow([article.title, article.url, article.summary, entities_str, struct_str])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=project_export_{project_id}.csv"}
    )

@app.get("/api/projects/{project_id}/stats")
def get_project_stats(project_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
        
    from sqlalchemy import func
    total = session.exec(select(func.count(Article.id)).where(Article.project_id == project_id)).one()
    pending = session.exec(select(func.count(Article.id)).where(Article.project_id == project_id).where(Article.status == "pending")).one()
    processing = session.exec(select(func.count(Article.id)).where(Article.project_id == project_id).where(Article.status == "processing")).one()
    completed = session.exec(select(func.count(Article.id)).where(Article.project_id == project_id).where(Article.status == "completed")).one()
    error = session.exec(select(func.count(Article.id)).where(Article.project_id == project_id).where(Article.status == "error")).one()
    return {"total": total, "pending": pending, "processing": processing, "completed": completed, "error": error}

# --- Monitoring Sources (Monitoring Station) ---

@app.get("/api/projects/{project_id}/sources", response_model=List[SourceRead])
def list_sources(project_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    
    sources = session.exec(select(Source).where(Source.project_id == project_id)).all()
    return sources

@app.post("/api/projects/{project_id}/sources", response_model=SourceRead)
def create_source(project_id: UUID, source_data: SourceCreate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    
    source = Source(
        **source_data.dict(),
        project_id=project_id,
        org_id=org_id
    )
    session.add(source)
    session.commit()
    session.refresh(source)
    return source

@app.patch("/api/sources/{source_id}", response_model=SourceRead)
def update_source(source_id: UUID, source_update: SourceUpdate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    source = session.exec(select(Source).where(Source.id == source_id).where(Source.org_id == org_id)).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found or access denied")
    
    for key, value in source_update.dict(exclude_unset=True).items():
        setattr(source, key, value)
    
    session.add(source)
    session.commit()
    session.refresh(source)
    return source

@app.delete("/api/sources/{source_id}")
def delete_source(source_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    source = session.exec(select(Source).where(Source.id == source_id).where(Source.org_id == org_id)).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found or access denied")
    
    session.delete(source)
    session.commit()
    return {"detail": "Source deleted"}

# --- Model Library & Training ---

@app.get("/api/projects/{project_id}/adapters", response_model=List[ModelAdapterRead])
def list_adapters(project_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    # Verify project belongs to org
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
        
    adapters = session.exec(select(ModelAdapter).where(ModelAdapter.project_id == project_id)).all()
    return adapters

@app.post("/api/projects/{project_id}/train", response_model=ModelAdapterRead)
def train_adapter(project_id: UUID, req: TrainingRequest, background_tasks: BackgroundTasks, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    
    # Count reviewed articles
    reviewed_count = session.exec(select(func.count(Article.id)).where(Article.project_id == project_id).where(Article.reviewed == True)).one()
    if reviewed_count < 1:
        raise HTTPException(status_code=400, detail="At least 1 reviewed article is required for training.")
    
    config = project.extraction_config or DEFAULT_CONFIG
    base_model = config.get("model_id", "fastino/gliner2-base-v1")
    
    adapter = ModelAdapter(
        project_id=project_id,
        name=req.name,
        description=req.description,
        base_model=base_model,
        num_samples=reviewed_count,
        status="training",
        org_id=org_id
    )
    session.add(adapter)
    session.commit()
    session.refresh(adapter)
    
    background_tasks.add_task(train_model_task, adapter.id, req.epochs, req.batch_size, req.lora_rank, req.lora_alpha)
    return adapter

@app.post("/api/projects/{project_id}/activate-adapter/{adapter_id}")
def activate_adapter(project_id: UUID, adapter_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    adapter = session.exec(select(ModelAdapter).where(ModelAdapter.id == adapter_id).where(ModelAdapter.project_id == project_id)).first()
    if not project or not adapter:
        raise HTTPException(status_code=404, detail="Project or Adapter not found or access denied")
    
    if adapter.status != "completed":
        raise HTTPException(status_code=400, detail="Only completed adapters can be activated.")
    
    config = project.extraction_config.copy()
    config["active_adapter_id"] = str(adapter_id)
    config["active_adapter_path"] = adapter.adapter_path
    
    project.extraction_config = config
    session.add(project)
    session.commit()
    return {"message": f"Adapter '{adapter.name}' activated."}

@app.post("/api/projects/{project_id}/deactivate-adapter")
def deactivate_adapter(project_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    
    config = project.extraction_config.copy()
    config.pop("active_adapter_id", None)
    config.pop("active_adapter_path", None)
    
    project.extraction_config = config
    session.add(project)
    session.commit()
    return {"message": "Adapter deactivated. Using base model."}

def train_model_task(adapter_id: UUID, epochs: int, batch_size: int, lora_rank: int, lora_alpha: float):
    from database import engine
    from sqlmodel import Session
    from models import Project, Article, Annotation, ModelAdapter
    import os
    
    with Session(engine) as session:
        adapter = session.get(ModelAdapter, adapter_id)
        if not adapter: return
        project = session.get(Project, adapter.project_id)
        if not project: return
        
        try:
            # 1. Prepare Dataset
            articles = session.exec(select(Article).where(Article.project_id == project.id).where(Article.reviewed == True)).all()
            
            examples = []
            for art in articles:
                # Group annotations by label
                entities = {}
                for ann in art.annotations:
                    label = ann.label
                    text = art.content[ann.start:ann.end]
                    if label not in entities:
                        entities[label] = []
                    entities[label].append(text)
                
                # Format into InputExample (Entities only for now, can be extended)
                examples.append(InputExample(
                    text=art.content,
                    entities=entities
                ))
            
            # 2. Configure Training
            adapter_dir = os.path.join("adapters", str(adapter_id))
            os.makedirs(adapter_dir, exist_ok=True)
            
            config = TrainingConfig(
                output_dir=adapter_dir,
                experiment_name=adapter.name,
                num_epochs=epochs,
                batch_size=batch_size,
                gradient_accumulation_steps=1,
                use_lora=True,
                lora_r=lora_rank,
                lora_alpha=lora_alpha,
                save_adapter_only=True,
                fp16=False, # Disable for local CPU training or ensure availability
                logging_steps=10
            )
            
            # 3. Run Trainer
            model = GLiNER2.from_pretrained(adapter.base_model)
            trainer = GLiNER2Trainer(model=model, config=config)
            
            # We use a simple train set for now (no validation split in this first version)
            trainer.train(train_data=examples)
            
            # 4. Success
            adapter.status = "completed"
            adapter.adapter_path = os.path.join(adapter_dir, "final")
            session.add(adapter)
            session.commit()
            
        except Exception as e:
            adapter.status = "error"
            import traceback
            traceback.print_exc()
            session.add(adapter)
            session.commit()

@app.get("/api/articles/{article_id}", response_model=ArticleReadWithAnnotations)
def get_article(article_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    article = session.exec(
        select(Article).join(Project).where(Article.id == article_id).where(Project.org_id == org_id)
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found or access denied")
    # Trigger loading of relationship for serialization
    _ = article.annotations
    return article

@app.patch("/api/articles/{article_id}", response_model=ArticleRead)
def update_article(article_id: UUID, data: ArticleUpdate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    article = session.exec(
        select(Article).join(Project).where(Article.id == article_id).where(Project.org_id == org_id)
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found or access denied")
    
    if data.title is not None:
        article.title = data.title
    if data.summary is not None:
        article.summary = data.summary
    if data.reviewed is not None:
        article.reviewed = data.reviewed
    if data.structured_data is not None:
        article.structured_data = data.structured_data
        
    session.add(article)
    session.commit()
    session.refresh(article)
    return article

@app.delete("/api/articles/{article_id}")
def delete_article(article_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    article = session.exec(
        select(Article).join(Project).where(Article.id == article_id).where(Project.org_id == org_id)
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found or access denied")
    session.delete(article)
    session.commit()
    return {"message": "Article deleted"}

@app.patch("/api/articles/{article_id}/annotations")
def update_annotations(article_id: UUID, data: AnnotationUpdate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    article = session.exec(
        select(Article).join(Project).where(Article.id == article_id).where(Project.org_id == org_id)
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found or access denied")
    session.exec(delete(Annotation).where(Annotation.article_id == article_id))
    for ann in data.annotations:
        new_ann = Annotation(article_id=article_id, start=ann.start, end=ann.end, label=ann.label, org_id=org_id)
        session.add(new_ann)
    session.commit()
    return {"message": "Annotations updated"}

def process_article_task(article_id: UUID):
    from database import engine
    from sqlmodel import Session
    from models import Project, Article, Annotation
    import bs4
    import re

    with Session(engine) as session:
        article = session.get(Article, article_id)
        if not article: return
        project = session.get(Project, article.project_id)
        if not project: return
        
        config = project.extraction_config or DEFAULT_CONFIG
        model_id = config.get("model_id", "fastino/gliner2-base-v1")
        adapter_path = config.get("active_adapter_path")
        summary_model_id = config.get("summary_model_id", "sshleifer/distilbart-cnn-12-6")
        threshold = config.get("threshold", 0.3)
        
        article.status = "processing"
        article.processing_step = "Downloading source..."
        article.reviewed = False # Reset reviewed status on reprocess
        session.add(article)
        session.commit()
        
        try:
            response = requests.get(article.url, timeout=60, impersonate="chrome", allow_redirects=True)
            response.raise_for_status()
            doc = Document(response.text)
            article.title = doc.title()
            soup = bs4.BeautifulSoup(doc.summary(), "lxml")
            
            # Base text extraction
            clean_text = re.sub(r'\n{2,}', '\n\n', soup.get_text(separator="\n").strip())
            
            # --- Content Cleaning (Internal Slop Removal) ---
            # ONLY remove very specific artifacts that are definitely not article content
            slop_patterns = [
                r"^list of \d+ items$",
                r"^end of list$",
                r"^Advertisement$",
                r"^Story continues below advertisement$",
            ]
            for pattern in slop_patterns:
                clean_text = re.sub(pattern, "", clean_text, flags=re.IGNORECASE | re.MULTILINE)
            
            # --- Content Cleaning (Start Detection) ---
            cleaning_cfg = config.get("cleaning", {})
            if cleaning_cfg.get("use_local_model", False):
                article.processing_step = "Identifying article start point..."
                session.add(article)
                session.commit()
                # We use a T5 model to identify where the actual story begins
                tokenizer, model = get_cleaning_model()
                
                # Analyze a bit more context
                context = clean_text[:2000]
                prompt = f"Identify the exact first sentence of the news story, ignoring all headers and navigation: {context}"
                
                inputs = tokenizer(prompt, return_tensors="pt", max_length=1024, truncation=True)
                outputs = model.generate(inputs["input_ids"], max_length=120)
                first_sentence = tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
                
                if first_sentence and len(first_sentence) > 10:
                    # Use a shorter marker to find the start more reliably
                    marker = first_sentence[:40]
                    idx = clean_text.find(marker)
                    
                    if idx != -1 and idx < 1500:
                        # Find the start of the line containing this sentence
                        line_start = clean_text.rfind("\n", 0, idx)
                        if line_start != -1:
                            clean_text = clean_text[line_start:].strip()
                        else:
                            clean_text = clean_text[idx:].strip()
                    else:
                        # Fallback for line-by-line if exact find fails
                        lines = clean_text.split("\n")
                        for i, line in enumerate(lines[:20]):
                            if marker[:20] in line:
                                clean_text = "\n".join(lines[i:]).strip()
                                break

            # Final cleanup of excessive newlines
            clean_text = re.sub(r'\n{3,}', '\n\n', clean_text).strip()
            article.content = clean_text
            
            article.processing_step = "Generating summary..."
            session.add(article)
            session.commit()
            tokenizer, model = get_summarizer(summary_model_id)
            input_text = clean_text[:3000]
            if len(input_text) > 100:
                inputs = tokenizer(input_text, return_tensors="pt", max_length=1024, truncation=True)
                summary_ids = model.generate(inputs["input_ids"], max_length=150, min_length=40, length_penalty=2.0, num_beams=4, early_stopping=True)
                article.summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
            else:
                article.summary = clean_text
            
            article.processing_step = f"Running GLiNER2 extraction (Adapter: {'Yes' if adapter_path else 'No'})..."
            session.add(article)
            session.commit()
            extractor = get_gliner(model_id, adapter_path)
            schema = build_gliner_schema(extractor, config)
            results = extractor.extract(clean_text, schema, threshold=threshold, include_spans=True)
            
            session.exec(delete(Annotation).where(Annotation.article_id == article_id))
            
            # results['entities'] is a dict like {'label': [{'text': '...', 'start': 0, 'end': 5}, ...]}
            entity_groups = results.get("entities", {})
            count = 0
            for label, items in entity_groups.items():
                for ent in items:
                    ann = Annotation(
                        article_id=article_id, 
                        start=ent["start"], 
                        end=ent["end"], 
                        label=label,
                        org_id=article.org_id
                    )
                    session.add(ann)
                    count += 1
            
            article.structured_data = {k: v for k, v in results.items() if k != "entities"}
            article.status = "completed"
            article.processing_step = None
            print(f"Extraction complete: found {count} entities for {article.url}")
        except Exception as e:
            article.status = "error"
            article.error_message = f"{type(e).__name__}: {str(e)}"
            import traceback
            traceback.print_exc()
        
        session.add(article)
        session.commit()

@app.post("/api/articles/{article_id}/process")
def process_article(article_id: UUID, background_tasks: BackgroundTasks, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    article = session.exec(
        select(Article).join(Project).where(Article.id == article_id).where(Project.org_id == org_id)
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found or access denied")
    background_tasks.add_task(process_article_task, article_id)
    return {"message": "Processing started in background"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
