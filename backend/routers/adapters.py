from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select, func
from database import get_session
from auth import get_current_org_id
from models import Project, ModelAdapter, ModelAdapterRead, TrainingRequest, Article
from utils.config import DEFAULT_CONFIG
from tasks.training_tasks import train_model_task

router = APIRouter(tags=["adapters"])

@router.get("/api/projects/{project_id}/adapters", response_model=List[ModelAdapterRead])
def list_adapters(project_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
        
    adapters = session.exec(select(ModelAdapter).where(ModelAdapter.project_id == project_id)).all()
    return adapters

@router.post("/api/projects/{project_id}/train", response_model=ModelAdapterRead)
def train_adapter(project_id: UUID, req: TrainingRequest, background_tasks: BackgroundTasks, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    
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
    
    background_tasks.add_task(
        train_model_task, 
        adapter.id, 
        req.epochs, 
        req.batch_size, 
        req.lora_rank, 
        req.lora_alpha,
        req.encoder_lr,
        req.task_lr,
        req.warmup_ratio,
        req.weight_decay,
        req.use_early_stopping
    )
    return adapter

@router.post("/api/projects/{project_id}/activate-adapter/{adapter_id}")
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

@router.post("/api/projects/{project_id}/deactivate-adapter")
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
