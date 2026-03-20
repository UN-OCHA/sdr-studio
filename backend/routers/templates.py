from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from auth import get_current_org_id
from models import ProjectTemplate, ProjectTemplateRead, ProjectTemplateCreate, ProjectTemplateUpdate

router = APIRouter(prefix="/api/templates", tags=["templates"])

@router.get("", response_model=List[ProjectTemplateRead])
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
                    },
                    "classifications": {
                        "Impact Level": {
                            "labels": ["Minor", "Moderate", "Severe", "Extreme"],
                            "multi_label": False,
                            "threshold": 0.5
                        },
                        "Reporting Language": {
                            "labels": ["English", "Spanish", "French", "Other"],
                            "multi_label": True,
                            "threshold": 0.3
                        }
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
                    },
                    "classifications": {
                        "Conflict Type": {
                            "labels": ["State-based", "Non-state", "One-sided", "Other"],
                            "multi_label": True,
                            "threshold": 0.4
                        }
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

@router.post("", response_model=ProjectTemplateRead)
def create_template(data: ProjectTemplateCreate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    template = ProjectTemplate(**data.model_dump(), org_id=org_id)
    session.add(template)
    session.commit()
    session.refresh(template)
    return template

@router.get("/{template_id}", response_model=ProjectTemplateRead)
def get_template(template_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    template = session.exec(select(ProjectTemplate).where(ProjectTemplate.id == template_id).where(ProjectTemplate.org_id == org_id)).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.patch("/{template_id}", response_model=ProjectTemplateRead)
def update_template(template_id: UUID, data: ProjectTemplateUpdate, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    template = session.exec(select(ProjectTemplate).where(ProjectTemplate.id == template_id).where(ProjectTemplate.org_id == org_id)).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template.sqlmodel_update(data.dict(exclude_unset=True))
    
    session.add(template)
    session.commit()
    session.refresh(template)
    return template

@router.delete("/{template_id}")
def delete_template(template_id: UUID, org_id: str = Depends(get_current_org_id), session: Session = Depends(get_session)):
    template = session.exec(select(ProjectTemplate).where(ProjectTemplate.id == template_id).where(ProjectTemplate.org_id == org_id)).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    session.delete(template)
    session.commit()
    return {"message": "Template deleted"}
