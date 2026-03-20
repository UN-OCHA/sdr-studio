from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from auth import get_current_org_id
from models import Project, Source, SourceRead, SourceCreate, SourceUpdate

router = APIRouter(tags=["sources"])

@router.get("/api/projects/{project_id}/sources", response_model=List[SourceRead])
def list_sources(project_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    
    sources = session.exec(select(Source).where(Source.project_id == project_id)).all()
    return sources

@router.post("/api/projects/{project_id}/sources", response_model=SourceRead)
def create_source(project_id: UUID, source_data: SourceCreate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    project = session.exec(select(Project).where(Project.id == project_id).where(Project.org_id == org_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    
    source = Source(
        **source_data.model_dump(),
        project_id=project_id,
        org_id=org_id
    )
    session.add(source)
    session.commit()
    session.refresh(source)
    return source

@router.patch("/api/sources/{source_id}", response_model=SourceRead)
def update_source(source_id: UUID, source_update: SourceUpdate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    source = session.exec(select(Source).where(Source.id == source_id).where(Source.org_id == org_id)).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found or access denied")
    
    source.sqlmodel_update(source_update.dict(exclude_unset=True))
    
    session.add(source)
    session.commit()
    session.refresh(source)
    return source

@router.delete("/api/sources/{source_id}")
def delete_source(source_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    source = session.exec(select(Source).where(Source.id == source_id).where(Source.org_id == org_id)).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found or access denied")
    
    session.delete(source)
    session.commit()
    return {"detail": "Source deleted"}
